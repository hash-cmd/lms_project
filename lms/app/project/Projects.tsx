import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';
import { Link, router } from 'expo-router';
import ButtonPageTabs from '@/components/custom/ButtonPageTabs';
import { Ionicons } from '@expo/vector-icons';
import API_BASE_URL from '@/constants/config/api';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import axios from 'axios';

type Phase = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  completed: boolean;
};

type Project = {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  completed: boolean;
  phases: Phase[];
};

const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ongoing' | 'completed'>('ongoing');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
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
      setProjects(data);
    } catch (err) {
      setError(err.message || 'Failed to load projects');
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    Haptics.selectionAsync();
    setRefreshing(true);
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const toggleProjectCompletion = useCallback(async (projectId: string) => {
    Haptics.selectionAsync();
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      const response = await axios.put(
        `${API_BASE_URL}/projects/${projectId}/complete/`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status !== 200) {
        throw new Error('Failed to update project');
      }

      const updatedProject = response.data;
      setProjects(prevProjects =>
        prevProjects.map(project =>
          project.id === projectId ? updatedProject : project
        )
      );
    } catch (err) {
      console.error('Error toggling project completion:', err);
      Alert.alert('Error', 'Failed to update project status');
    }
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const matchesTab = activeTab === 'ongoing' ? !project.completed : project.completed;
      const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [projects, activeTab, searchQuery]);

  const calculateProjectProgress = useCallback((project: Project): number => {
    if (project.completed) return 100;
    const phases = project.phases || [];
    if (phases.length === 0) return 0;
    
    if (phases.every(p => p.start_date && p.end_date)) {
      const now = new Date();
      let totalWeight = 0;
      let completedWeight = 0;

      phases.forEach(phase => {
        const start = new Date(phase.start_date);
        const end = new Date(phase.end_date);
        const duration = end.getTime() - start.getTime();
        
        if (phase.completed) {
          completedWeight += duration;
        } else if (now >= start) {
          const progressDuration = Math.min(now.getTime(), end.getTime()) - start.getTime();
          completedWeight += (progressDuration / duration) * duration;
        }
        
        totalWeight += duration;
      });

      return totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
    }
    
    const completed = phases.filter(p => p.completed).length;
    return (completed / phases.length) * 100;
  }, []);

  const formatDate = useCallback((dateString: string) => {
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
  }, []);

  const renderProjectItem = ({ item }: { item: Project }) => {
    const completionPercentage = calculateProjectProgress(item);
    const completedPhases = item.phases?.filter(p => p.completed).length || 0;
    const totalPhases = item.phases?.length || 0;

    return (
      <TouchableOpacity 
        style={styles.projectCard}
        onPress={() => !item.completed && router.push(`/project/UpdateProject?id=${item.id}`)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={item.completed ? ['#28a745', '#5cb85c'] : ['#6a11cb', '#2575fc']}
          style={styles.cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
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
              {completedPhases}/{totalPhases} phases completed
            </Text>
            
            <TouchableOpacity
              onPress={() => toggleProjectCompletion(item.id)}
              style={styles.completeButton}
            >
              <Ionicons
                name={item.completed ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.progressBarContainer}>
            <View style={[
              styles.progressBar,
              { width: `${completionPercentage}%` },
              completionPercentage === 100 && styles.completedProgressBar,
            ]} />
            <Text style={styles.progressText}>{Math.round(completionPercentage)}%</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

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
          <Text style={styles.headerTitle}>My Projects</Text>
          <Link href="/project/AddProject" asChild>
            <TouchableOpacity style={styles.addButtonContainer}>
              <LinearGradient
                colors={['#6a11cb', '#2575fc']}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </Link>
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
              onPress={() => setActiveTab('ongoing')}
              activeOpacity={0.8}
            >
              {activeTab === 'ongoing' ? (
                <LinearGradient
                  colors={['#6a11cb', '#2575fc']}
                  style={styles.activeFilter}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.activeFilterText}>Ongoing</Text>
                </LinearGradient>
              ) : (
                <View style={styles.filterButton}>
                  <Text style={styles.filterButtonText}>Ongoing</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setActiveTab('completed')}
              activeOpacity={0.8}
            >
              {activeTab === 'completed' ? (
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
        ) : filteredProjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open" size={48} color="#adb5bd" />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching projects found' : 'No projects yet'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredProjects}
            renderItem={renderProjectItem}
            keyExtractor={(item) => item.id}
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
      
      <View style={styles.tabs}>
        <ButtonPageTabs />
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
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 64,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#e9ecef',
    minHeight: 40,
  },
  activeFilter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 64,
    marginHorizontal: 4,
    borderRadius: 8,
    minHeight: 40,
  },
  filterButtonText: {
    color: '#495057',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
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
  completeButton: {
    padding: 4,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  completedProgressBar: {
    backgroundColor: '#28a745',
  },
  progressText: {
    position: 'absolute',
    right: 4,
    top: -2,
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
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

export default Projects;