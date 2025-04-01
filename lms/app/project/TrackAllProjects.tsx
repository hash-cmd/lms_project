import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView, 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  FlatList, 
  TouchableOpacity,
  RefreshControl,
  Platform 
} from 'react-native';
import ButtonPageTabs from '@/components/custom/ButtonPageTabs';
import { Colors } from '@/constants/Colors';
import { CircularProgressBase } from 'react-native-circular-progress-indicator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import API_BASE_URL from '@/constants/config/api';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

type Phase = {
  id: string;
  title: string;
  completed: boolean;
  start_date: string;
  end_date: string;
  completed_at?: string;
};

type Project = {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  completed: boolean;
  completed_at?: string;
  phases?: Phase[];
};

type CompletionStats = {
  early: number;
  inProgress: number;
  late: number;
};

type ProgressStats = {
  progress: number;
  completion: CompletionStats;
  total: number;
};

const TrackAllProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState({
    projects: {
      progress: 0,
      completion: { early: 0, inProgress: 0, late: 0 },
      total: 0
    },
    phases: {
      progress: 0,
      completion: { early: 0, inProgress: 0, late: 0 },
      total: 0
    }
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchProjects = async () => {
    try {
      setRefreshing(true);
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) throw new Error('Authentication required');

      const response = await fetch(`${API_BASE_URL}/projects/`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) throw new Error('Failed to fetch projects');
      
      const data = await response.json();
      setProjects(data);
      calculateStats(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const calculateStats = (projects: Project[]) => {
    const projectStats = calculateCompletionStats(
      projects,
      (p) => p.completed,
      (p) => p.completed_at,
      (p) => p.end_date
    );

    const allPhases = projects.flatMap(p => p.phases || []);
    const phaseStats = calculateCompletionStats(
      allPhases,
      (p) => p.completed,
      (p) => p.completed_at,
      (p) => p.end_date
    );

    setStats({
      projects: {
        progress: calculateProgress(projects, (p) => p.completed),
        completion: projectStats,
        total: projects.length
      },
      phases: {
        progress: calculateProgress(allPhases, (p) => p.completed),
        completion: phaseStats,
        total: allPhases.length
      }
    });
  };

  const calculateCompletionStats = <T extends unknown>(
    items: T[],
    isCompleted: (item: T) => boolean,
    getCompletedAt: (item: T) => string | undefined,
    getEndDate: (item: T) => string
  ): CompletionStats => {
    const stats: CompletionStats = { early: 0, inProgress: 0, late: 0 };

    items.forEach(item => {
      if (isCompleted(item)) {
        const completedAt = getCompletedAt(item);
        const endDate = getEndDate(item);
        
        if (completedAt) {
          const completionDate = new Date(completedAt);
          const dueDate = new Date(endDate);
          const timeDiff = completionDate.getTime() - dueDate.getTime();
          
          if (timeDiff < 0) {
            stats.early++;
          } else if (timeDiff === 0) {
            stats.inProgress++;
          } else {
            stats.late++;
          }
        }
      } else {
        stats.inProgress++;
      }
    });

    return stats;
  };

  const calculateProgress = <T extends unknown>(
    items: T[],
    isCompleted: (item: T) => boolean
  ): number => {
    if (items.length === 0) return 0;
    const completed = items.filter(item => isCompleted(item)).length;
    return (completed / items.length) * 100;
  };

  const calculateProjectProgress = (project: Project): number => {
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
  };

  const renderProjectItem = ({ item }: { item: Project }) => {
    const progress = calculateProjectProgress(item);
    const isCompleted = item.completed;
    const endDate = new Date(item.end_date);
    const completedAt = isCompleted && item.completed_at ? new Date(item.completed_at) : null;
    const hasPhases = item.phases && item.phases.length > 0;
    const completedPhases = item.phases?.filter(p => p.completed).length || 0;
    const totalPhases = item.phases?.length || 0;

    let statusText = 'In Progress';
    let statusColor = '#6a11cb'; // Updated to gradient start color
    
    if (isCompleted) {
      statusText = 'Completed';
      statusColor = '#28a745'; // Success green
    } else if (new Date() > new Date(item.end_date)) {
      statusText = 'Overdue';
      statusColor = '#dc3545'; // Error red
    }

    return (
      <TouchableOpacity
        onPress={() => router.push(`/project/UpdateProject?id=${item.id}`)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={isCompleted ? ['#28a745', '#5cb85c'] : ['#6a11cb', '#2575fc']} // Updated gradient
          style={[styles.projectCard, isCompleted && styles.completedCard]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.projectContent}>
            <View style={styles.textContainer}>
              <Text style={styles.projectTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.projectDescription} numberOfLines={2}>{item.description}</Text>
              
              {hasPhases && (
                <View style={styles.phasesInfo}>
                  <Text style={styles.phasesText}>
                    {completedPhases}/{totalPhases} phases completed
                  </Text>
                  {totalPhases > 0 && (
                    <View style={styles.phaseProgressBar}>
                      <View 
                        style={[
                          styles.phaseProgressFill,
                          { width: `${(completedPhases / totalPhases) * 100}%` }
                        ]} 
                      />
                    </View>
                  )}
                </View>
              )}
              
              {completedAt && (
                <Text style={styles.completionDate}>
                  Completed: {completedAt.toLocaleDateString()}
                </Text>
              )}
            </View>

            <View style={styles.progressContainer}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusText}
              </Text>
              <Text style={styles.dueDate}>{endDate.toLocaleDateString()}</Text>
              <View style={styles.progressCircle}>
                <CircularProgressBase
                  value={progress}
                  radius={28}
                  duration={800}
                  activeStrokeColor={isCompleted ? '#28a745' : '#6a11cb'} // Updated colors
                  inActiveStrokeColor="#e5e7eb"
                  inActiveStrokeOpacity={0.8}
                />
                <Text style={[
                  styles.progressText,
                  { color: isCompleted ? '#28a745' : '#6a11cb' } // Updated colors
                ]}>
                  {Math.round(progress)}%
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderStatCard = (
    title: string, 
    stats: ProgressStats
  ) => (
    <LinearGradient
      colors={['#6a11cb', '#2575fc']} // Updated gradient
      style={styles.statCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={styles.statTitle}>{title}</Text>
      <View style={styles.progressCircle}>
        <CircularProgressBase
          value={stats.progress}
          radius={30}
          duration={800}
          activeStrokeColor="#a5b4fc"
          inActiveStrokeColor="rgba(255,255,255,0.2)"
        />
        <Text style={styles.statProgressText}>{Math.round(stats.progress)}%</Text>
      </View>
      <View style={styles.statDetails}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>✓ Early</Text>
          <Text style={styles.statValue}>{stats.completion.early}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>🔄 In Progress</Text>
          <Text style={styles.statValue}>{stats.completion.inProgress}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>⌛ Late</Text>
          <Text style={styles.statValue}>{stats.completion.late}</Text>
        </View>
      </View>
      <Text style={styles.statTotal}>Total: {stats.total}</Text>
    </LinearGradient>
  );

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchProjects}
            tintColor="#6a11cb" // Updated color
          />
        }
      >
        <Text style={styles.header}>Project Tracker</Text>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsContainer}
        >
          {renderStatCard('Projects', stats.projects)}
          {renderStatCard('Phases', stats.phases)}
        </ScrollView>

        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>
            Your Projects ({projects.length})
          </Text>
          {stats.projects.total > 0 && (
            <Text style={styles.completionRate}>
              {Math.round((stats.projects.completion.early) / 
               stats.projects.total * 100)}% early completion rate
            </Text>
          )}
        </View>
        <FlatList
          data={projects}
          renderItem={renderProjectItem}
          keyExtractor={item => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.listContainer}
        />
      </ScrollView>

      <BlurView intensity={90} tint="light" style={styles.tabBar}>
        <ButtonPageTabs />
      </BlurView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa', // Updated to match admin background
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 90,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2d2d2d', // Updated to match admin text color
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto',
  },
  statsContainer: {
    paddingBottom: 16,
  },
  statCard: {
    width: 180,
    borderRadius: 16,
    padding: 16,
    marginRight: 16,
    shadowColor: '#6a11cb', // Updated to match gradient
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  statTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  progressCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  statProgressText: {
    position: 'absolute',
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  statDetails: {
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  statValue: {
    color: 'white',
    fontWeight: '700',
  },
  statTotal: {
    color: 'white',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2d2d2d', // Updated to match admin text color
  },
  completionRate: {
    fontSize: 14,
    color: '#6d6d6d', // Updated to match admin secondary text
    marginLeft: 8,
  },
  listContainer: {
    paddingBottom: 24,
  },
  projectCard: {
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  completedCard: {
    opacity: 0.7,
  },
  projectContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff', // White text for gradient background
    marginBottom: 4,
  },
  projectDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)', // Semi-transparent white
    marginBottom: 8,
    lineHeight: 20,
  },
  phasesInfo: {
    marginTop: 4,
    marginBottom: 8,
  },
  phasesText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)', // Semi-transparent white
    marginBottom: 4,
  },
  phaseProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  phaseProgressFill: {
    height: '100%',
    backgroundColor: '#fff', // White progress bar
  },
  completionDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontStyle: 'italic',
  },
  progressContainer: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  dueDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  progressText: {
    fontWeight: '600',
    fontSize: 12,
    position: 'absolute',
  },
  tabBar: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    backgroundColor: '#fff',
  },
});

export default TrackAllProjects;