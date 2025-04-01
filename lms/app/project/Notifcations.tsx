import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import axios from 'axios';
import API_BASE_URL from '@/constants/config/api';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Background task name
const BACKGROUND_FETCH_TASK = 'update-project-notifications';

// Register the background task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    await updateProjectNotifications();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

const NotificationsComponent = () => {
  const PROJECTS_CACHE_KEY = '@user_projects_cache';
  const [cachedProjects, setCachedProjects] = useState([]);

  // Request permissions
  const setupNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Notification permission not granted');
    }
    
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('project-reminders', {
        name: 'Project Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }
  };

  // Format time for comparison
  const formatTimeString = (date, time) => {
    const [hours, minutes] = time.split(':');
    const newDate = new Date(date);
    newDate.setHours(parseInt(hours), parseInt(minutes));
    return newDate;
  };

  // Calculate all notification times
  const calculateNotifications = (projects) => {
    const now = new Date();
    const notifications = [];

    projects.forEach(project => {
      if (project.completed) return;

      if (project.start_date && project.start_time) {
        const startTime = formatTimeString(project.start_date, project.start_time);
        const notifyTime = new Date(startTime.getTime() - 15 * 60000);
        
        if (notifyTime > now) {
          notifications.push({
            identifier: `project-start-${project.id}`,
            content: {
              title: 'Project starting soon',
              body: `${project.title} starts in 15 minutes`,
              data: { projectId: project.id, type: 'project-start' },
              sound: true,
            },
            trigger: { date: notifyTime.getTime() },
          });
        }
      }

      if (project.end_date && project.end_time) {
        const endTime = formatTimeString(project.end_date, project.end_time);
        const notifyTime = new Date(endTime.getTime() - 15 * 60000);
        
        if (notifyTime > now) {
          notifications.push({
            identifier: `project-end-${project.id}`,
            content: {
              title: 'Project ending soon',
              body: `${project.title} ends in 15 minutes`,
              data: { projectId: project.id, type: 'project-end' },
              sound: true,
            },
            trigger: { date: notifyTime.getTime() },
          });
        }
      }

      if (project.phases && Array.isArray(project.phases)) {
        project.phases.forEach(phase => {
          if (phase.completed) return;

          if (phase.start_date && phase.start_time) {
            const phaseStart = formatTimeString(phase.start_date, phase.start_time);
            const notifyTime = new Date(phaseStart.getTime() - 15 * 60000);
            
            if (notifyTime > now) {
              notifications.push({
                identifier: `phase-start-${project.id}-${phase.id}`,
                content: {
                  title: 'Phase starting soon',
                  body: `Phase "${phase.title}" of ${project.title} starts in 15 minutes`,
                  data: { 
                    projectId: project.id, 
                    phaseId: phase.id,
                    type: 'phase-start'
                  },
                  sound: true,
                },
                trigger: { date: notifyTime.getTime() },
              });
            }
          }

          if (phase.end_date && phase.end_time) {
            const phaseEnd = formatTimeString(phase.end_date, phase.end_time);
            const notifyTime = new Date(phaseEnd.getTime() - 15 * 60000);
            
            if (notifyTime > now) {
              notifications.push({
                identifier: `phase-end-${project.id}-${phase.id}`,
                content: {
                  title: 'Phase ending soon',
                  body: `Phase "${phase.title}" of ${project.title} ends in 15 minutes`,
                  data: { 
                    projectId: project.id, 
                    phaseId: phase.id,
                    type: 'phase-end'
                  },
                  sound: true,
                },
                trigger: { date: notifyTime.getTime() },
              });
            }
          }
        });
      }
    });

    return notifications;
  };

  // Schedule notifications
  const scheduleNotifications = async (notifications) => {
    const scheduledIds = [];
    
    // First cancel all existing notifications
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    // Schedule new ones
    for (const notif of notifications) {
      try {
        await Notifications.scheduleNotificationAsync(notif);
        scheduledIds.push(notif.identifier);
      } catch (error) {
        console.error('Failed to schedule notification:', error);
      }
    }
    
    return scheduledIds;
  };

  // Fetch projects with auth
  const fetchProjects = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      const response = await axios.get(`${API_BASE_URL}/projects/`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status !== 200) {
        throw new Error('Failed to fetch projects');
      }

      const data = response.data;
      await AsyncStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(data));
      return data;
    } catch (error) {
      console.error('Error fetching projects:', error);
      const cached = await AsyncStorage.getItem(PROJECTS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    }
  };

  // Core update function
  const updateProjectNotifications = async () => {
    try {
      await setupNotifications();
      const projects = await fetchProjects();
      setCachedProjects(projects);
      const notifications = calculateNotifications(projects);
      await scheduleNotifications(notifications);
    } catch (error) {
      console.error('Notification update error:', error);
    }
  };

  // Setup app state listener
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        updateProjectNotifications();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Main effect
  useEffect(() => {
    updateProjectNotifications();

    // Register background task
    const registerBackgroundTask = async () => {
      try {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: 15 * 60, // 15 minutes
          stopOnTerminate: false,
          startOnBoot: true,
        });
      } catch (error) {
        console.error('Background fetch registration error:', error);
      }
    };

    registerBackgroundTask();

    const interval = setInterval(updateProjectNotifications, 60 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
      BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    };
  }, []);

  return null;
};

export default NotificationsComponent;