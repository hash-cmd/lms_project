import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Platform, 
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Dimensions,
  Linking
} from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AdminButtonPageTabs from '@/components/custom/AdminButtonPageTabs';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import API_BASE_URL from '@/constants/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';

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
  type: string;
  title: string;
  timestamp: string;
  time_ago: string;
  icon: string;
}

interface DashboardData {
  userCount: number;
  activeUsers: number;
  newUsers: number;
  projectsCount: number;
  activities: Activity[];
  projectsCompleted: number;
  projectsInProgress: number;
  projectsOnTime: number;
  projectsLate: number;
  onTimePercentage: number;
  latePercentage: number;
  dailyVisits: number;
}

interface DashboardCard {
  id: string;
  title: string;
  value: string | number;
  icon: string;
  color?: string;
}

const AdminDashboard = () => {
  const [isTruncated, setIsTruncated] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    userCount: 0,
    activeUsers: 0,
    newUsers: 0,
    projectsCount: 0,
    activities: [],
    projectsCompleted: 0,
    projectsInProgress: 0,
    projectsOnTime: 0,
    projectsLate: 0,
    onTimePercentage: 0,
    latePercentage: 0,
    dailyVisits: 0
  });

  const { width } = Dimensions.get('window');
  const cardWidth = width * 0.44;

  const fullText = 'Learning Management System';
  const truncatedText = 'LMS Dashboard';
  const router = useRouter();

  const fetchDashboardData = useCallback(async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('Authentication required. Please log in again.');
      }

      setLoading(true);
      
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard-stats/`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        timeout: 10000
      });

      if (response.data.status === 'success') {
        setDashboardData({
          userCount: response.data.stats.total_users || 0,
          activeUsers: response.data.stats.active_users_today || 0,
          newUsers: response.data.stats.new_users_today || 0,
          projectsCount: response.data.stats.total_projects || 0,
          activities: response.data.recent_activities || [],
          projectsCompleted: response.data.stats.projects_completed || 0,
          projectsInProgress: response.data.stats.projects_in_progress || 0,
          projectsOnTime: response.data.stats.projects_on_time || 0,
          projectsLate: response.data.stats.projects_late || 0,
          onTimePercentage: response.data.stats.on_time_percentage || 0,
          latePercentage: response.data.stats.late_percentage || 0,
          dailyVisits: response.data.stats.daily_visits || 0
        });
        setError(null);
      } else {
        throw new Error(response.data.message || 'Failed to load dashboard stats');
      }
    } catch (err) {
      let errorMessage = 'Failed to fetch dashboard data. Please try again later.';
      
      if (err instanceof axios.AxiosError) {
        if (err.response) {
          errorMessage = err.response.data.message || 
            `Server error: ${err.response.status}`;
          if (err.response.status === 500) {
            errorMessage = 'Server error. Our team has been notified. Please try again later.';
          }
        } else if (err.request) {
          errorMessage = 'No response from server. Check your network connection.';
        } else if (err.code === 'ECONNABORTED') {
          errorMessage = 'Request timeout. Please check your connection and try again.';
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      console.error('Dashboard fetch error details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  const toggleTruncation = () => {
    Haptics.selectionAsync();
    setIsTruncated(!isTruncated);
  };

  const handleCardPress = (cardId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    switch(cardId) {
      case 'user-count':
        router.push('/admin/usersettings/AllUsers/');
        break;
      case 'active-users':
        router.push('/admin/usersettings/ActiveUsers/');
        break;
      case 'new-users':
        router.push('/admin/usersettings/AllUsers/');
        break;
      case 'projects':
        router.push('/admin/mainpage/AdminProjects/');
        break;
      default:
        console.log(`Card ${cardId} pressed`);
    }
  };

  const handlePersonIconPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/main/Settings');
  };

  const formatCount = (count: number) => {
    return count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const dashboardCards: DashboardCard[] = [
    {
      id: 'user-count',
      title: 'Total Users',
      value: loading ? '...' : error ? 'Error' : formatCount(dashboardData.userCount),
      icon: 'people',
      color: '#6a11cb'
    },
    {
      id: 'active-users',
      title: 'Active Users',
      value: loading ? '...' : error ? 'Error' : formatCount(dashboardData.activeUsers),
      icon: 'person',
      color: '#2575fc'
    },
    {
      id: 'new-users',
      title: 'New Users',
      value: loading ? '...' : error ? 'Error' : formatCount(dashboardData.newUsers),
      icon: 'person-add',
      color: '#8e44ad'
    },
    {
      id: 'projects',
      title: 'Total Projects',
      value: loading ? '...' : error ? 'Error' : formatCount(dashboardData.projectsCount),
      icon: 'folder',
      color: '#3498db'
    }
  ];

  if (error && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color={Colors.light.danger} />
          <Text style={styles.errorText}>Error loading dashboard</Text>
          <Text style={styles.errorSubText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={fetchDashboardData}
          >
            <LinearGradient
              colors={['#6a11cb', '#2575fc']}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
        >
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={handlePersonIconPress}
            >
              <LinearGradient
                colors={['#6a11cb', '#2575fc']}
                style={styles.avatarGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="person" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={toggleTruncation}>
              <Text style={styles.headerText}>
                {isTruncated ? truncatedText : fullText}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.iconContainer}
              onPress={() => router.push('/admin/mainpage/AdminNotifications')}
            >
              <Ionicons name="notifications" size={20} color={Colors.light.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.cardsContainer}>
            {dashboardCards.map((card) => (
              <TouchableOpacity 
                key={card.id}
                onPress={() => handleCardPress(card.id)}
                style={[styles.card, { width: cardWidth }]}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[card.color || Colors.light.primary, '#2575fc']}
                  style={styles.cardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardTextContainer}>
                      <Text style={styles.cardTitle}>{card.title}</Text>
                      {loading ? (
                        <ActivityIndicator size="small" color={Colors.light.background} />
                      ) : (
                        <Text style={styles.cardValue}>{card.value}</Text>
                      )}
                    </View>
                    <View style={styles.cardIcon}>
                      <Ionicons 
                        name={card.icon as any} 
                        size={24} 
                        color="#fff" 
                      />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <TouchableOpacity onPress={fetchDashboardData}>
                <Text style={styles.viewAllText}>Refresh</Text>
              </TouchableOpacity>
            </View>
            
            {loading ? (
              <ActivityIndicator size="small" color={Colors.light.primary} />
            ) : dashboardData.activities.length === 0 ? (
              <Text style={styles.emptyText}>No recent activity</Text>
            ) : (
              <View style={styles.activityContainer}>
                {dashboardData.activities.map((activity, index) => (
                  <View key={`${activity.timestamp}-${index}`} style={styles.activityItem}>
                    <View style={styles.activityIcon}>
                      <Ionicons 
                        name={activity.icon as any} 
                        size={18} 
                        color={Colors.light.primary} 
                      />
                    </View>
                    <View style={styles.activityText}>
                      <Text style={styles.activityTitle}>{activity.title}</Text>
                      <Text style={styles.activityTime}>{activity.time_ago}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Project Completion Stats</Text>
            
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, {color: Colors.light.success}]}>
                  {loading ? '...' : error ? 'Error' : `${dashboardData.onTimePercentage}%`}
                </Text>
                <Text style={styles.statLabel}>On Time</Text>
                <Text style={styles.statLabel}>
                  ({formatCount(dashboardData.projectsOnTime)}/{formatCount(dashboardData.projectsCompleted)})
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statValue, {color: Colors.light.danger}]}>
                  {loading ? '...' : error ? 'Error' : `${dashboardData.latePercentage}%`}
                </Text>
                <Text style={styles.statLabel}>Completed Late</Text>
                <Text style={styles.statLabel}>
                  ({formatCount(dashboardData.projectsLate)}/{formatCount(dashboardData.projectsCompleted)})
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {loading ? '...' : error ? 'Error' : formatCount(dashboardData.projectsInProgress)}
                </Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </View>
            </View>
            
            <View style={[styles.statsContainer, {marginTop: 10}]}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {loading ? '...' : error ? 'Error' : formatCount(dashboardData.dailyVisits)}
                </Text>
                <Text style={styles.statLabel}>Daily Visits</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {loading ? '...' : error ? 'Error' : formatCount(dashboardData.projectsCompleted)}
                </Text>
                <Text style={styles.statLabel}>Total Completed</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {loading ? '...' : error ? 'Error' : formatCount(dashboardData.projectsCount)}
                </Text>
                <Text style={styles.statLabel}>All Projects</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.tabs}>
          <AdminButtonPageTabs />
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
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
    paddingBottom: 80,
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(106, 17, 203, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6a11cb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  cardGradient: {
    padding: 16,
    borderRadius: 16,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginBottom: 4,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardValue: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  sectionContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.textPrimary,
  },
  viewAllText: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  activityContainer: {
    marginTop: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.lightGray,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(106, 17, 203, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityText: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    color: Colors.light.textPrimary,
    fontWeight: '500',
  },
  activityTime: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statItem: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.light.lightGray,
    width: '30%',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  tabs: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: Colors.light.danger,
    marginTop: 16,
    fontWeight: 'bold',
  },
  errorSubText: {
    fontSize: 14,
    color: Colors.light.gray,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradientButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.light.textSecondary,
    marginVertical: 20,
  },
});

export default AdminDashboard;