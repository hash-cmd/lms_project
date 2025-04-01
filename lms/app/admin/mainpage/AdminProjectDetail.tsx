import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Image,
  Alert,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_BASE_URL from '@/constants/config/api';
import { format } from 'date-fns';

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
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    profile_picture_url?: string;
  };
  created_at: string;
  updated_at: string;
}

const AdminProjectDetail = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { project } = route.params as { project: Project };
  
  const [loading, setLoading] = useState(false);
  const [projectDetails, setProjectDetails] = useState<Project>(project);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const accessToken = await AsyncStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE_URL}/admin/projects/${project.id}/`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.data.status === 'success') {
        setProjectDetails(response.data.project);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch project details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
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
              await axios.delete(`${API_BASE_URL}/admin/projects/${project.id}/`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete project');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          },
        },
      ]
    );
  };

  const navigateToUserProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('UserProfile', { userId: project.user.id });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return 'N/A';
    try {
      return format(new Date(`1970-01-01T${timeString}`), 'h:mm a');
    } catch {
      return timeString;
    }
  };

  const getUserInitials = () => {
    const { user } = projectDetails;
    return `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}`.toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#f8f9fa', '#ffffff']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#6a11cb" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Project Details</Text>
          <TouchableOpacity 
            onPress={handleDeleteProject}
            style={styles.deleteButton}
          >
            <Ionicons name="trash" size={24} color="#dc3545" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          <LinearGradient
            colors={projectDetails.completed ? ['#28a745', '#5cb85c'] : ['#6a11cb', '#2575fc']}
            style={styles.projectHeader}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.projectTitle}>{projectDetails.title}</Text>
            {projectDetails.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{projectDetails.category}</Text>
              </View>
            )}
            {projectDetails.completed && (
              <View style={styles.completedBadge}>
                <Text style={styles.completedText}>COMPLETED</Text>
              </View>
            )}
          </LinearGradient>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>
              {projectDetails.description || 'No description provided'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Project Owner</Text>
            <TouchableOpacity 
              style={styles.userContainer}
              onPress={navigateToUserProfile}
            >
              {projectDetails.user.profile_picture_url ? (
                <Image 
                  source={{ uri: projectDetails.user.profile_picture_url }}
                  style={styles.userAvatar}
                />
              ) : (
                <View style={styles.userAvatarPlaceholder}>
                  <Text style={styles.userInitials}>{getUserInitials()}</Text>
                </View>
              )}
              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {projectDetails.user.first_name} {projectDetails.user.last_name}
                </Text>
                <Text style={styles.userEmail}>{projectDetails.user.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6d6d6d" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar" size={20} color="#6a11cb" />
              <Text style={styles.detailLabel}>Start Date</Text>
              <Text style={styles.detailValue}>{formatDate(projectDetails.start_date)}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Ionicons name="flag" size={20} color="#6a11cb" />
              <Text style={styles.detailLabel}>End Date</Text>
              <Text style={styles.detailValue}>{formatDate(projectDetails.end_date)}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Ionicons name="time" size={20} color="#6a11cb" />
              <Text style={styles.detailLabel}>Start Time</Text>
              <Text style={styles.detailValue}>{formatTime(projectDetails.start_time)}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Ionicons name="time" size={20} color="#6a11cb" />
              <Text style={styles.detailLabel}>End Time</Text>
              <Text style={styles.detailValue}>{formatTime(projectDetails.end_time)}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Phases ({projectDetails.phases?.length || 0})</Text>
            {projectDetails.phases?.length > 0 ? (
              projectDetails.phases.map((phase, index) => (
                <View key={phase.id || index} style={styles.phaseItem}>
                  <Text style={styles.phaseTitle}>{phase.title}</Text>
                  <Text style={styles.phaseDescription}>{phase.description}</Text>
                  <View style={styles.phaseMeta}>
                    <Text style={styles.phaseStatus}>
                      {phase.completed ? 'Completed' : 'In Progress'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noPhasesText}>No phases added to this project</Text>
            )}
          </View>

          <View style={styles.metaSection}>
            <Text style={styles.metaText}>
              Created: {formatDate(projectDetails.created_at)}
            </Text>
            <Text style={styles.metaText}>
              Last Updated: {formatDate(projectDetails.updated_at)}
            </Text>
            {projectDetails.completed_at && (
              <Text style={styles.metaText}>
                Completed: {formatDate(projectDetails.completed_at)}
              </Text>
            )}
          </View>
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d2d2d',
  },
  deleteButton: {
    padding: 4,
  },
  container: {
    paddingBottom: 20,
  },
  projectHeader: {
    padding: 20,
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  projectTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  completedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  completedText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d2d2d',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 15,
    color: '#4a4a4a',
    lineHeight: 22,
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInitials: {
    color: '#6a11cb',
    fontWeight: 'bold',
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d2d2d',
  },
  userEmail: {
    fontSize: 14,
    color: '#6d6d6d',
    marginTop: 2,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    marginBottom: 20,
  },
  detailItem: {
    width: '50%',
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6d6d6d',
    marginTop: 8,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2d2d2d',
  },
  phaseItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  phaseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d2d2d',
    marginBottom: 4,
  },
  phaseDescription: {
    fontSize: 14,
    color: '#6d6d6d',
    marginBottom: 8,
  },
  phaseMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  phaseStatus: {
    fontSize: 13,
    color: '#6a11cb',
    fontWeight: '500',
  },
  noPhasesText: {
    fontSize: 14,
    color: '#6d6d6d',
    fontStyle: 'italic',
  },
  metaSection: {
    marginHorizontal: 16,
    padding: 16,
  },
  metaText: {
    fontSize: 13,
    color: '#6d6d6d',
    marginBottom: 4,
  },
});

export default AdminProjectDetail;