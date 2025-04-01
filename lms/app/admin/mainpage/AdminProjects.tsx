import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  FlatList,
  TextInput,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import API_BASE_URL from '@/constants/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import AdminButtonPageTabs from '@/components/custom/AdminButtonPageTabs';


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

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string;
}

interface Project {
  id: number;
  title: string;
  description: string;
  category: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  phases: any[];
  completed: boolean;
  completed_at: string | null;
  user: User;
  created_at: string;
  updated_at: string;
}

const AdminProjects = () => {
  const navigation = useNavigation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  const fetchProjects = useCallback(async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) throw new Error('Authentication required');

      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_BASE_URL}/admin/projects/`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        params: { search: searchQuery, status: statusFilter }
      });

      if (response.data.status === 'success') {
        setProjects(response.data.projects);
      } else {
        throw new Error(response.data.message || 'Failed to fetch projects');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProjects();
  }, [fetchProjects]);

  const handleDeleteProject = async (projectId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Project',
      'Are you sure you want to delete this project?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const accessToken = await AsyncStorage.getItem('accessToken');
              await axios.delete(`${API_BASE_URL}/admin/projects/${projectId}/`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });
              setProjects(prev => prev.filter(p => p.id !== projectId));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              Alert.alert('Error', 'Failed to delete project');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          },
        },
      ]
    );
  };

  // Change this navigation call:
  const navigateToProjectDetail = (projectId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('/admin/mainpage/AdminProjectDetail', { projectId });
  };

  const navigateToCreateProject = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('CreateProject');
  };

  const navigateToUserProfile = (userId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('/admin/usersettings/UserDetails', { userId });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getUserInitials = (user: User) => {
    return `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}`.toUpperCase();
  };

  const renderProjectItem = ({ item }: { item: Project }) => (
    <TouchableOpacity 
      style={styles.projectCard}
      // onPress={() => navigateToProjectDetail(item.id)} // Pass only the ID
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={item.completed ? ['#28a745', '#5cb85c'] : ['#6a11cb', '#2575fc']}
        style={styles.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity 
          style={styles.userContainer}
          onPress={(e) => {
            e.stopPropagation();
            // navigateToUserProfile(item.user.id);
          }}
        >
          {item.user.profile_picture_url ? (
            <Image 
              source={{ uri: item.user.profile_picture_url }}
              style={styles.userAvatar}
            />
          ) : (
            <View style={styles.userAvatarPlaceholder}>
              <Text style={styles.userInitials}>{getUserInitials(item.user)}</Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {item.user.first_name} {item.user.last_name}
            </Text>
            <Text style={styles.userEmail}>{item.user.email}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.cardHeader}>
          <Text style={styles.projectTitle} numberOfLines={1}>{item.title}</Text>
          {item.completed && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>Completed</Text>
            </View>
          )}
        </View>
        
        {item.description && (
          <Text style={styles.projectDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        
        <View style={styles.projectMeta}>
          {item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          )}
          
          <View style={styles.dateContainer}>
            {item.start_date && (
              <View style={styles.dateItem}>
                <Ionicons name="calendar" size={14} color="#fff" />
                <Text style={styles.dateText}>{formatDate(item.start_date)}</Text>
              </View>
            )}
            
            {item.end_date && (
              <View style={styles.dateItem}>
                <Ionicons name="flag" size={14} color="#fff" />
                <Text style={styles.dateText}>{formatDate(item.end_date)}</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.cardFooter}>
          <Text style={styles.phasesText}>
            {item.phases?.length || 0} phases
          </Text>
          
          <TouchableOpacity 
            onPress={(e) => {
              e.stopPropagation();
              handleDeleteProject(item.id);
            }}
            style={styles.deleteButton}
          >
            <Ionicons name="trash" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (error && !loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#dc3545" />
          <Text style={styles.errorText}>Error loading projects</Text>
          <Text style={styles.errorSubText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={fetchProjects}
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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>All Projects</Text>
           {/* <TouchableOpacity 
            onPress={navigateToCreateProject}
            style={styles.addButtonContainer}
          >
            <LinearGradient
              colors={['#6a11cb', '#2575fc']}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity> */}
        </View>
        
        <View style={styles.filterContainer}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#6d6d6d" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search projects..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#6d6d6d"
            />
          </View>
          
          <View style={styles.filterButtons}>
            <TouchableOpacity
              onPress={() => setStatusFilter('all')}
              activeOpacity={0.8}
            >
              {statusFilter === 'all' ? (
                <LinearGradient
                  colors={['#6a11cb', '#2575fc']}
                  style={styles.activeFilter}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.activeFilterText}>All</Text>
                </LinearGradient>
              ) : (
                <View style={styles.filterButton}>
                  <Text style={styles.filterButtonText}>All</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setStatusFilter('active')}
              activeOpacity={0.8}
            >
              {statusFilter === 'active' ? (
                <LinearGradient
                  colors={['#6a11cb', '#2575fc']}
                  style={styles.activeFilter}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.activeFilterText}>Active</Text>
                </LinearGradient>
              ) : (
                <View style={styles.filterButton}>
                  <Text style={styles.filterButtonText}>Active</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setStatusFilter('completed')}
              activeOpacity={0.8}
            >
              {statusFilter === 'completed' ? (
                <LinearGradient
                  colors={['#6a11cb', '#2575fc']}
                  style={styles.activeFilter}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.activeFilterText}>Completed</Text>
                </LinearGradient>
              ) : (
                <View style={styles.filterButton}>
                  <Text style={styles.filterButtonText}>Completed</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
        
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6a11cb" />
          </View>
        ) : projects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open" size={48} color="#adb5bd" />
            <Text style={styles.emptyText}>No projects found</Text>
            <Text style={styles.emptySubText}>
              {searchQuery ? 'Try a different search' : ''}
            </Text>
          </View>
        ) : (
          <FlatList
            data={projects}
            renderItem={renderProjectItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#6a11cb']}
                tintColor="#6a11cb"
              />
            }
          />
        )}
      </LinearGradient>
      {/* Bottom Tabs */}
        <View style={styles.tabs}>
        <AdminButtonPageTabs />
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d2d2d',
  },
  addButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradientButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#2d2d2d',
  },
  filterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  filterButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',  // Add this
    paddingVertical: 8,
    paddingHorizontal: 40,  // Add horizontal padding
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#e9ecef',
    minHeight: 40,  // Ensure consistent height
  },
  activeFilter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',  // Add this
    paddingVertical: 8,
    paddingHorizontal: 40,  // Add horizontal padding
    marginHorizontal: 4,
    borderRadius: 8,
    minHeight: 40,  // Ensure consistent height
  },
  filterButtonText: {
    color: '#495057',  // Changed from #6d6d6d to darker gray
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',  // Added for better visibility
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  projectCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardGradient: {
    padding: 16,
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInitials: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  userEmail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  completedBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  completedText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  projectDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
    lineHeight: 20,
  },
  projectMeta: {
    marginBottom: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    color: '#fff',
  },
  dateContainer: {
    marginTop: 4,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    color: '#fff',
    marginLeft: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 12,
  },
  phasesText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  deleteButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#2d2d2d',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#6d6d6d',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#dc3545',
    marginTop: 16,
    fontWeight: 'bold',
  },
  errorSubText: {
    fontSize: 14,
    color: '#adb5bd',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tabs: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
    backgroundColor: '#fff',
  },
});

export default AdminProjects;