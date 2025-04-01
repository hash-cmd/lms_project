import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  RefreshControl,
  ScrollView,
  Platform,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Avatar } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar, DateData } from 'react-native-calendars';
import { BarChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import ButtonPageTabs from '@/components/custom/ButtonPageTabs';
import API_BASE_URL from '@/constants/config/api';

type Project = {
  id: string;
  title: string;
  description: string;
  end_date: string;
  completed_at?: string;
  completed: boolean;
};

type MarkedDate = {
  selected: boolean;
  selectedColor: string;
  dotColor: string;
  marked: boolean;
};

type MarkedDates = Record<string, MarkedDate>;

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = Platform.OS === 'ios' ? 100 : 90;
const MENU_WIDTH = width * 0.75;

const Dashboard = () => {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [localProfilePicture, setLocalProfilePicture] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedDateProjects, setSelectedDateProjects] = useState<Project[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT],
    extrapolate: 'clamp',
  });

  const markedDates = useMemo<MarkedDates>(() => {
    return projects.reduce<MarkedDates>((acc, project) => {
      if (project.end_date) {
        const date = new Date(project.end_date).toISOString().split('T')[0];
        
        if (project.completed) {
          // Project is completed - check if it was late or early
          const completedDate = project.completed_at ? new Date(project.completed_at) : null;
          const endDate = new Date(project.end_date);
          
          if (completedDate) {
            if (completedDate > endDate) {
              // Completed late - red
              acc[date] = {
                selected: true,
                selectedColor: '#ef4444',
                dotColor: '#fff',
                marked: true,
              };
            } else {
              // Completed on time or early - green
              acc[date] = {
                selected: true,
                selectedColor: '#10b981',
                dotColor: '#fff',
                marked: true,
              };
            }
          }
        } else {
          // Project is in progress - use the current color
          acc[date] = {
            selected: true,
            selectedColor: '#6366f1',
            dotColor: '#fff',
            marked: true,
          };
        }
      }
      return acc;
    }, {});
  }, [projects]);

  const completionPercentage = useMemo(() => {
    const totalProjects = projects.length;
    if (totalProjects === 0) return 0;
    const completedProjects = projects.filter(p => p.completed).length;
    return Math.round((completedProjects / totalProjects) * 100);
  }, [projects]);

  const chartData = useMemo(() => {
    const counts = projects.reduce(
      (acc, project) => {
        if (project.completed && project.completed_at) {
          const completedDate = new Date(project.completed_at);
          const endDate = new Date(project.end_date);
          
          if (completedDate < endDate) {
            acc.early++;
          } else if (completedDate > endDate) {
            acc.late++;
          } 
        } else if (!project.completed) {
          acc.inProgress++;
        }
        return acc;
      },
      { early: 0, late: 0, inProgress: 0 }
    );

    const total = counts.early + counts.late + counts.inProgress;
    const calculatePercentage = (count: number) =>
      total > 0 ? Math.round((count / total) * 100) : 0;

    return {
      labels: ['Early', 'Late', 'In Progress'],
      datasets: [{
        data: [
          calculatePercentage(counts.early),
          calculatePercentage(counts.late),
          calculatePercentage(counts.inProgress),
        ],
      }],
    };
  }, [projects]);

  const loadLocalProfilePicture = async () => {
    try {
      const localImageUri = await AsyncStorage.getItem('localProfileImage');
      if (localImageUri) {
        const fileInfo = await FileSystem.getInfoAsync(localImageUri);
        if (fileInfo.exists) {
          setLocalProfilePicture(localImageUri);
        } else {
          await AsyncStorage.removeItem('localProfileImage');
        }
      }
    } catch (error) {
      console.error('Error loading local profile picture:', error);
    }
  };

  const fetchUserData = async () => {
    const storedUser = await AsyncStorage.getItem('user');
    if (!storedUser) return null;
    
    const user = JSON.parse(storedUser);
    
    await loadLocalProfilePicture();
    
    if (user.profile_picture) {
      if (user.profile_picture.startsWith('http')) {
        user.profile_picture_url = user.profile_picture;
      } else {
        const cleanPath = user.profile_picture.startsWith('/') 
          ? user.profile_picture.substring(1) 
          : user.profile_picture;
        user.profile_picture_url = `${API_BASE_URL}/media/${cleanPath}`;
      }
    }
    
    return user;
  };

  const fetchProjects = async () => {
    const accessToken = await AsyncStorage.getItem('accessToken');
    if (!accessToken) throw new Error('Authentication required');

    const response = await fetch(`${API_BASE_URL}/projects/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error('Failed to fetch projects');
    return response.json();
  };

  const fetchRewardPoints = async () => {
    const accessToken = await AsyncStorage.getItem('accessToken');
    if (!accessToken) throw new Error('Authentication required');

    const response = await fetch(`${API_BASE_URL}/reward/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error('Failed to fetch rewards');
    return response.json();
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [userData, projectsData, rewardsData] = await Promise.all([
        fetchUserData(),
        fetchProjects(),
        fetchRewardPoints(),
      ]);

      setUserName(userData?.username || '');
      setUserEmail(userData?.email || '');
      setProfilePicture(userData?.profile_picture_url || null);
      setProjects(projectsData || []);
      setRewardPoints(rewardsData?.points || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleDayPress = useCallback((day: DateData) => {
    Haptics.selectionAsync();
    const filteredProjects = projects.filter(
      (project) => new Date(project.end_date).toISOString().split('T')[0] === day.dateString
    );
    setSelectedDateProjects(filteredProjects);
    setIsModalVisible(true);
  }, [projects]);

  const toggleMenu = useCallback(() => {
    Haptics.selectionAsync();
    const toValue = isMenuOpen ? -MENU_WIDTH : 0;
    setIsMenuOpen(!isMenuOpen);
    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isMenuOpen, slideAnim]);

  const handleLogout = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      const [accessToken, refreshToken] = await Promise.all([
        AsyncStorage.getItem('accessToken'),
        AsyncStorage.getItem('refreshToken'),
      ]);

      if (!accessToken || !refreshToken) {
        throw new Error('Authentication tokens not found');
      }

      await fetch(`${API_BASE_URL}/logout/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user', 'localProfileImage']);
      router.replace('/intro/LoginScreen');
    } catch (err) {
      Alert.alert('Logout Error', 'Failed to logout. Please try again.');
      console.error('Logout error:', err);
    }
  }, [router]);

  const onRefresh = useCallback(() => {
    Haptics.selectionAsync();
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fetchData, fadeAnim]);

  const scrollHandler = useCallback(
    Animated.event(
      [
        {
          nativeEvent: {
            contentOffset: { y: scrollY }
          }
        }
      ],
      { useNativeDriver: false }
    ),
    []
  );

  const renderProfilePicture = () => {
    if (localProfilePicture) {
      return (
        <Image 
          source={{ uri: localProfilePicture }} 
          style={styles.avatar} 
          onError={() => setLocalProfilePicture(null)}
        />
      );
    } else if (profilePicture) {
      return (
        <Image 
          source={{ 
            uri: profilePicture,
            headers: profilePicture.startsWith('http') ? {
              Authorization: `Bearer ${AsyncStorage.getItem('accessToken')}`,
            } : undefined,
            cache: 'reload'
          }} 
          style={styles.avatar} 
          onError={() => setProfilePicture(null)}
        />
      );
    } else {
      return (
        <Avatar.Icon
          size={36}
          icon="account"
          style={[styles.avatar, { backgroundColor: '#6a11cb' }]}
        />
      );
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Default Header */}
      <Animated.View style={[
        styles.defaultHeader, 
        { 
          height: HEADER_HEIGHT,
          transform: [{ translateY: headerTranslateY }],
          paddingTop: Platform.OS === 'ios' ? 50 : 20,
        }
      ]}>
        <TouchableOpacity
          onPress={toggleMenu}
          activeOpacity={0.7}
          style={styles.menuButton}
        >
          <Ionicons name="menu" size={28} color="#6366f1" />
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.rewardButton}
            onPress={() => router.push('/main/Rewards')}
            activeOpacity={0.7}
          >
            <Ionicons name="trophy" size={22} color="gold" />
            <Text style={styles.rewardText}>{rewardPoints}</Text>
          </TouchableOpacity>
          
          <Link href="/main/Settings" asChild>
            <TouchableOpacity activeOpacity={0.7}>
              {renderProfilePicture()}
            </TouchableOpacity>
          </Link>
        </View>
      </Animated.View>

      {/* Fixed Header */}
      <Animated.View style={[
        styles.fixedHeader, 
        { 
          height: HEADER_HEIGHT,
          opacity: scrollY.interpolate({
            inputRange: [0, HEADER_HEIGHT],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          }),
          paddingTop: Platform.OS === 'ios' ? 50 : 20,
          paddingBottom: Platform.OS === 'ios' ? 10 : 0,
        }
      ]}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.rewardButton}
            onPress={() => router.push('/main/Rewards')}
            activeOpacity={0.7}
          >
            <Ionicons name="trophy" size={22} color="gold" />
            <Text style={styles.rewardText}>{rewardPoints}</Text>
          </TouchableOpacity>
          
          <Link href="/main/Settings" asChild>
            <TouchableOpacity activeOpacity={0.7}>
              {renderProfilePicture()}
            </TouchableOpacity>
          </Link>
        </View>
      </Animated.View>

      {/* Side Menu */}
      <Animated.View
        style={[
          styles.menu,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        <LinearGradient
          colors={['#6a11cb', '#2575fc']}
          style={styles.menuGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.menuHeader}>
            {localProfilePicture ? (
              <Image 
                source={{ uri: localProfilePicture }} 
                style={styles.menuAvatar} 
                onError={() => setLocalProfilePicture(null)}
              />
            ) : profilePicture ? (
              <Image 
                source={{ 
                  uri: profilePicture,
                  headers: profilePicture.startsWith('http') ? {
                    Authorization: `Bearer ${AsyncStorage.getItem('accessToken')}`,
                  } : undefined,
                  cache: 'reload'
                }} 
                style={styles.menuAvatar} 
                onError={() => setProfilePicture(null)}
              />
            ) : (
              <Avatar.Icon
                size={80}
                icon="account"
                style={[styles.menuAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              />
            )}
            <Text style={styles.menuUserName}>{userName || 'Guest'}</Text>
            <Text style={styles.menuUserEmail}>
              {userEmail || 'Guest'}
            </Text>
          </View>
          
          <View style={styles.menuLinks}>
            {[
              { icon: 'account-cog', text: 'Profile Settings', route: '/main/Settings' },
              { icon: 'trophy', text: 'Rewards', route: '/main/Rewards' },
              // { icon: 'stats-chart', text: 'Statistics', route: '/main/Statistics' },
              { icon: 'logout', text: 'Logout', action: handleLogout },
            ].map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuLink}
                onPress={() => {
                  toggleMenu();
                  item.action ? item.action() : router.push(item.route);
                }}
                accessibilityLabel={item.text}
              >
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={24}
                  color="white"
                />
                <Text style={styles.menuLinkText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Scrollable Content */}
      <Animated.ScrollView
        contentContainerStyle={[
          styles.scrollViewContent, 
          { 
            paddingTop: Platform.OS === 'ios' ? HEADER_HEIGHT - 20 : HEADER_HEIGHT + 10 
          }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* Greeting Card */}
        <View style={styles.greetingCard}>
          <LinearGradient
            colors={['#6a11cb', '#2575fc']}
            style={styles.greetingGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.greeting}>
              Hello, <Text style={styles.userName}>{userName || 'Guest'}!</Text>
            </Text>
            <Text style={styles.subText}>Track your progress and stay productive</Text>
          </LinearGradient>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>Overall Completion: {completionPercentage}%</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${completionPercentage}%` }
              ]} 
            />
          </View>
        </View>

        {/* Habit Performance */}
        <LinearGradient
            colors={['#6a11cb', '#2575fc']}
            style={styles.card}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
        <View>
          <View style={styles.cardHeader}>
            <Ionicons name="stats-chart" size={24} color="white" />
            <Text style={styles.cardHeaderText}>Habit Performance</Text>
          </View>
          <BarChart
            data={chartData}
            width={width - 80}
            height={220}
            yAxisLabel=""
            yAxisSuffix="%"
            fromZero
            chartConfig={{
              backgroundGradientFrom: '#6366f1',
              backgroundGradientTo: '#6366f1',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: '#fff',
              },
            }}
            style={styles.chart}
            accessibilityLabel="Completion statistics chart"
          />
          <Text style={styles.cardFooterText}>Completion Stats</Text>
          
        </View>
        </LinearGradient>

        {/* Calendar */}
        <View style={styles.calendarCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar" size={24} color="#6a11cb" />
            <Text style={[styles.cardHeaderText, { color: '#6a11cb' }]}>
              Upcoming Deadlines
            </Text>
          </View>
          <Calendar
            markedDates={markedDates}
            theme={{
              backgroundColor: '#fff',
              calendarBackground: '#fff',
              textSectionTitleColor: '#6b7280',
              selectedDayBackgroundColor: '#6366f1',
              selectedDayTextColor: '#fff',
              todayTextColor: '#6a11cb',
              dayTextColor: '#111827',
              textDisabledColor: '#d1d5db',
              dotColor: '#6366f1',
              selectedDotColor: '#fff',
              arrowColor: '#6a11cb',
              monthTextColor: '#6a11cb',
              indicatorColor: '#6366f1',
              textDayFontWeight: '500',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '500',
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 14,
            }}
            onDayPress={handleDayPress}
            style={styles.calendar}
            accessibilityLabel="Calendar with project deadlines"
          />
        </View>
      </Animated.ScrollView>

      {/* Bottom Tabs */}
      <View style={styles.tabContainer}>
        <ButtonPageTabs />
      </View>

      {/* Projects Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
        accessibilityLabel="Projects due modal"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Projects Due</Text>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={styles.closeButton}
                accessibilityLabel="Close modal"
              >
                <Ionicons name="close" size={24} color="#6366f1" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={selectedDateProjects}
              renderItem={({ item }) => (
                <View style={styles.projectItem}>
                  <Text style={styles.projectTitle}>{item.title}</Text>
                  <Text style={styles.projectDescription}>{item.description}</Text>
                  <Text style={[
                    styles.projectStatus,
                    item.completed ? 
                      (new Date(item.completed_at!) > new Date(item.end_date) ? 
                        { color: '#ef4444' } : { color: '#10b981' }) : 
                      { color: '#6366f1' }
                  ]}>
                    {item.completed ? 
                      (new Date(item.completed_at!) > new Date(item.end_date) ? 
                        'Completed Late' : 'Completed On Time') : 
                      'In Progress'}
                  </Text>
                </View>
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.modalList}
              accessibilityLabel="List of projects due"
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#6366f1',
    padding: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  defaultHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'white',
    zIndex: 90,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    zIndex: 100,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6a11cb',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuButton: {
    padding: 8,
  },
  rewardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rewardText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6366f1',
    marginLeft: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  menuAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  greetingCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    height: 150,
  },
  greetingGradient: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  userName: {
    color: 'rgba(255,255,255,0.8)',
  },
  subText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  progressContainer: {
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  progressText: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  card: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  calendarCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  cardFooterText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  calendarGradient: {
    padding: 20,
  },
  chart: {
    borderRadius: 16,
  },
  calendar: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    backgroundColor: '#fff',
  },
  menu: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: MENU_WIDTH - 50,
    height: '85%',
    zIndex: 1000,
    marginTop: 100,
  },
  menuGradient: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 40 : 30,
  },
  menuHeader: {
    alignItems: 'center',
  },
  menuUserName: {
    color: 'white',
    paddingVertical: 8,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  menuUserEmail: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  menuLinks: {
    marginTop: 32,
  },
  menuLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  menuLinkText: {
    color: 'white',
    fontSize: 18,
    marginLeft: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    maxHeight: height * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
  },
  modalList: {
    paddingBottom: 20,
  },
  projectItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  projectDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  projectStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default React.memo(Dashboard);