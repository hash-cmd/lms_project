import { 
    StyleSheet, 
    Text, 
    View, 
    TouchableOpacity, 
    ActivityIndicator,
    ScrollView,
    RefreshControl 
  } from 'react-native';
  import React, { useState, useCallback, useEffect } from 'react';
  import { SafeAreaView } from 'react-native-safe-area-context';
  import { Ionicons } from '@expo/vector-icons';
  import { LinearGradient } from 'expo-linear-gradient';
  import * as Haptics from 'expo-haptics';
  import { useRouter } from 'expo-router';
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import axios from 'axios';
  import API_BASE_URL from '@/constants/config/api';
  
  const Colors = {
    light: {
      primary: '#6a11cb',
      secondary: '#2575fc',
      textPrimary: '#2d2d2d',
      textSecondary: '#6d6d6d',
      background: '#f8f9fa',
      lightGray: '#e9ecef',
      danger: '#dc3545',
      success: '#28a745',
      warning: '#ffc107',
      gray: '#adb5bd'
    }
  };
  
  interface Activity {
    uuid: string;
    id: string;
    type: string;
    title: string;
    description?: string;
    timestamp: string;
    time_ago: string;
    icon: string;
    user_id?: number;
    project_id?: number;
  }
  
  const Notifications = () => {
    const [notifications, setNotifications] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const router = useRouter();
  
    const getIconColor = (type: string) => {
      const colors = {
        'user_signup': '#4CAF50',
        'project_created': '#2196F3',
        'project_updated': '#FFC107',
        'project_completed': '#9C27B0'
      };
      return colors[type] || Colors.light.primary;
    };
  
    const fetchNotifications = useCallback(async (isRefreshing = false) => {
      try {
        const accessToken = await AsyncStorage.getItem('accessToken');
        if (!accessToken) {
          console.error('No access token found');
          return;
        }
  
        const currentPage = isRefreshing ? 1 : page;
        setLoading(true);
        setRefreshing(isRefreshing);
        
        const response = await axios.get(`${API_BASE_URL}/admin/activities/`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          params: { page: currentPage, page_size: 20 }
        });
  
        if (response.data.status === 'success') {
          const processedActivities = response.data.activities.map(activity => ({
            ...activity,
            uuid: activity.uuid || `${activity.type}_${activity.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }));
  
          if (isRefreshing) {
            setNotifications(processedActivities);
          } else {
            setNotifications(prev => [...prev, ...processedActivities]);
          }
          setHasMore(response.data.activities.length === 20);
          if (isRefreshing) setPage(1);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, [page]);
  
    useEffect(() => {
      fetchNotifications();
    }, [fetchNotifications]);
  
    const onRefresh = useCallback(() => {
      fetchNotifications(true);
    }, [fetchNotifications]);
  
    const handleEndReached = useCallback(() => {
      if (!loading && hasMore) {
        setPage(prev => prev + 1);
      }
    }, [loading, hasMore]);
  
    const handleProjectPress = useCallback((projectId: number) => {
      Haptics.selectionAsync();
      router.push({
        pathname: '/projects/[id]',
        params: { id: projectId.toString() }
      });
    }, []);
  
    const handleUserPress = useCallback((userId: number) => {
      Haptics.selectionAsync();
      router.push({
        pathname: '/admin/usersettings/UserDetails',
        params: { userId: userId.toString() }
      });
    }, []);
  
    const handleNotificationPress = useCallback((notification: Activity) => {
      if (notification.project_id) {
        handleProjectPress(notification.project_id);
      } else if (notification.user_id) {
        handleUserPress(notification.user_id);
      }
    }, [handleProjectPress, handleUserPress]);
  
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={['#f8f9fa', '#ffffff']}
          style={styles.backgroundGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.light.primary]}
                tintColor={Colors.light.primary}
              />
            }
            contentContainerStyle={styles.scrollContainer}
            onScroll={({ nativeEvent }) => {
              if (isCloseToBottom(nativeEvent)) {
                handleEndReached();
              }
            }}
            scrollEventThrottle={400}
          >
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.light.primary} />
              </TouchableOpacity>
              
              <Text style={styles.headerTitle}>Notifications</Text>
              
              <View style={styles.headerRightPlaceholder} />
            </View>
  
            <View style={styles.sectionContainer}>
              {loading && page === 1 ? (
                <ActivityIndicator size="small" color={Colors.light.primary} />
              ) : notifications.length === 0 ? (
                <Text style={styles.emptyText}>No notifications found</Text>
              ) : (
                <View style={styles.notificationsContainer}>
                  {notifications.map((item) => (
                    <TouchableOpacity 
                      key={item.uuid}
                      onPress={() => handleNotificationPress(item)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.notificationItem}>
                        <View style={[styles.notificationIcon, {backgroundColor: `${getIconColor(item.type)}20`}]}>
                          <Ionicons 
                            name={item.icon as any} 
                            size={20} 
                            color={getIconColor(item.type)} 
                          />
                        </View>
                        <View style={styles.notificationText}>
                          <Text style={styles.notificationTitle}>{item.title}</Text>
                          {item.description && (
                            <Text style={styles.notificationDescription}>{item.description}</Text>
                          )}
                          <Text style={styles.notificationTime}>{item.time_ago}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={Colors.light.gray} />
                      </View>
                    </TouchableOpacity>
                  ))}
                  {loading && page > 1 && (
                    <ActivityIndicator size="small" color={Colors.light.primary} />
                  )}
                  {!hasMore && (
                    <Text style={styles.endText}>No more notifications</Text>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  };
  
  const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }: any) => {
    const paddingToBottom = 20;
    return layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
  };
  
  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: '#fff',
    },
    backgroundGradient: {
      flex: 1,
    },
    scrollContainer: {
      paddingBottom: 20,
    },
    header: {
      padding: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: Colors.light.textPrimary,
      textAlign: 'center',
    },
    headerRightPlaceholder: {
      width: 40,
    },
    sectionContainer: {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    notificationsContainer: {
      marginTop: 8,
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Colors.light.lightGray,
    },
    notificationIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    notificationText: {
      flex: 1,
    },
    notificationTitle: {
      fontSize: 16,
      color: Colors.light.textPrimary,
      fontWeight: '500',
    },
    notificationDescription: {
      fontSize: 14,
      color: Colors.light.textSecondary,
      marginTop: 4,
    },
    notificationTime: {
      fontSize: 12,
      color: Colors.light.gray,
      marginTop: 4,
    },
    emptyText: {
      textAlign: 'center',
      color: Colors.light.textSecondary,
      marginVertical: 20,
    },
    endText: {
      textAlign: 'center',
      color: Colors.light.textSecondary,
      marginVertical: 10,
      fontStyle: 'italic',
    },
  });
  
  export default Notifications;