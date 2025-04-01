import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Platform,
  Modal,
  Alert,
  Switch,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Dropdown } from 'react-native-element-dropdown';
import API_BASE_URL from '@/constants/config/api';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Color scheme matching the original
const Colors = {
  light: {
    primary: '#6a11cb',
    textPrimary: '#2d2d2d',
    textSecondary: '#6d6d6d',
    background: '#f8f9fa',
    lightGray: '#e9ecef',
    error: '#dc3545'
  }
};

type Project = {
  id: string;
  title: string;
  description: string;
  category: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  phases: Phase[];
  completed: boolean;
  completed_at?: string;
};

type Phase = {
  id?: string;
  name: string;
  start_date: Date;
  end_date: Date;
  start_time: Date;
  end_time: Date;
  comment: string;
  completed: boolean;
};

type Category = {
  label: string;
  value: string;
};

const UpdateProject = () => {
  const { id } = useLocalSearchParams();
  const [refreshing, setRefreshing] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [showPicker, setShowPicker] = useState({
    startDate: false,
    endDate: false,
    startTime: false,
    endTime: false,
    phaseStartDate: false,
    phaseEndDate: false,
    phaseStartTime: false,
    phaseEndTime: false,
  });
  const [isPhaseModalVisible, setIsPhaseModalVisible] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<Phase | null>(null);
  const [phaseIndex, setPhaseIndex] = useState<number | null>(null);

  const categories: Category[] = [
    { label: 'Work', value: 'work' },
    { label: 'Personal', value: 'personal' },
    { label: 'School', value: 'school' },
    { label: 'Business', value: 'business' },
    { label: 'Health', value: 'health' },
  ];

  const { width, height } = Dimensions.get('window');

  // Calculate dynamic heights for platform compatibility
  const headerHeight = Platform.OS === 'ios' ? 120 : 80;
  const scrollContainerMarginTop = Platform.OS === 'ios' ? 90 : 70;
  const keyboardVerticalOffset = Platform.OS === 'ios' ? 100 : 0;

  const fetchProject = async () => {
    try {
      setRefreshing(true);
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) throw new Error('Authentication required');

      const response = await fetch(`${API_BASE_URL}/projects/${id}/`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) throw new Error('Failed to fetch project');
      
      const data = await response.json();
      const projectData = Array.isArray(data) ? data[0] : data;
      
      const parseTime = (timeString: string) => {
        const [hours, minutes] = timeString.split(':');
        const date = new Date();
        date.setHours(parseInt(hours, 10));
        date.setMinutes(parseInt(minutes, 10));
        return date;
      };

      setProject({
        ...projectData,
        start_date: new Date(projectData.start_date),
        end_date: new Date(projectData.end_date),
        start_time: parseTime(projectData.start_time),
        end_time: parseTime(projectData.end_time),
        phases: projectData.phases?.map(phase => ({
          ...phase,
          start_date: new Date(phase.start_date),
          end_date: new Date(phase.end_date),
          start_time: parseTime(phase.start_time),
          end_time: parseTime(phase.end_time)
        })) || []
      });
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) fetchProject();
  }, [id]);

  const handleUpdateField = (field: string, value: any) => {
    setProject(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleDateTimeChange = (type: string, date: Date) => {
    handleUpdateField(type, date);
    setShowPicker(prev => ({ ...prev, [type]: false }));
  };

  const handlePhaseSubmit = () => {
    if (!project || !currentPhase) return;

    const updatedPhases = [...project.phases];
    if (phaseIndex !== null) {
      updatedPhases[phaseIndex] = currentPhase;
    } else {
      updatedPhases.push(currentPhase);
    }

    handleUpdateField('phases', updatedPhases);
    resetPhaseModal();
  };

  const resetPhaseModal = () => {
    setCurrentPhase(null);
    setPhaseIndex(null);
    setIsPhaseModalVisible(false);
  };

  const updateProject = async (updatedProject: Project) => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) throw new Error('Authentication required');

      const formatTime = (date: Date) => 
        `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:00`;

      const payload = {
        ...updatedProject,
        start_date: updatedProject.start_date.toISOString().split('T')[0],
        end_date: updatedProject.end_date.toISOString().split('T')[0],
        start_time: formatTime(updatedProject.start_time),
        end_time: formatTime(updatedProject.end_time),
        phases: updatedProject.phases.map(phase => ({
          ...phase,
          start_date: phase.start_date.toISOString().split('T')[0],
          end_date: phase.end_date.toISOString().split('T')[0],
          start_time: formatTime(phase.start_time),
          end_time: formatTime(phase.end_time)
        })),
        completed_at: updatedProject.completed ? new Date().toISOString() : null
      };

      const response = await fetch(`${API_BASE_URL}/projects/update/${id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Update failed');
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message);
      return false;
    }
  };

  const handleToggleProjectComplete = async (value: boolean) => {
    if (!project) return;
    
    Haptics.selectionAsync();
    const updatedProject = { ...project, completed: value };
    setProject(updatedProject);
    
    const success = await updateProject(updatedProject);
    if (!success) {
      // Revert if update fails
      setProject({ ...updatedProject, completed: !value });
    }
  };

  const handleTogglePhaseComplete = async (index: number, value: boolean) => {
    if (!project) return;
    
    Haptics.selectionAsync();
    const updatedPhases = [...project.phases];
    updatedPhases[index].completed = value;
    
    const updatedProject = { ...project, phases: updatedPhases };
    setProject(updatedProject);
    
    const success = await updateProject(updatedProject);
    if (!success) {
      // Revert if update fails
      updatedPhases[index].completed = !value;
      setProject({ ...project, phases: updatedPhases });
    }
  };

  if (!project) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </SafeAreaView>
    );
  }

  const renderDateTimeButton = (type: string, value: Date, isDate = true) => (
    <TouchableOpacity
      onPress={() => setShowPicker(prev => ({ ...prev, [type]: true }))}
      style={styles.dateButton}
    >
      <Text style={styles.dateText}>
        {isDate 
          ? value.toLocaleDateString() 
          : value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      </Text>
      <Ionicons 
        name={isDate ? 'calendar' : 'time'} 
        size={20} 
        color={Colors.light.primary} 
      />
    </TouchableOpacity>
  );

  const renderDateTimePicker = (type: string, value: Date, mode: 'date' | 'time') => (
    showPicker[type] && (
      <DateTimePicker
        value={value}
        mode={mode}
        display="spinner"
        onChange={(_, date) => date && handleDateTimeChange(type, date)}
      />
    )
  );

  const renderPhaseItem = (phase: Phase, index: number) => (
    <View key={index} style={styles.phaseItem}>
      <View style={styles.phaseInfo}>
        <Text style={styles.phaseName} numberOfLines={1}>{phase.name}</Text>
        <Text style={styles.phaseDates}>
          {phase.start_date.toLocaleDateString()} - {phase.end_date.toLocaleDateString()}
        </Text>
        <Text style={styles.phaseTimes}>
          {phase.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {phase.end_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <Switch
        value={phase.completed}
        onValueChange={(value) => handleTogglePhaseComplete(index, value)}
        trackColor={{ false: '#767577', true: '#a5b4fc' }}
        thumbColor={phase.completed ? '#f5dd4b' : '#f4f3f4'}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header with gradient */}
      <LinearGradient
        colors={['#6a11cb', '#2575fc']}
        style={[styles.fixedHeader, { height: headerHeight }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Update Project</Text>
          <Switch
            value={project.completed}
            onValueChange={handleToggleProjectComplete}
            trackColor={{ false: '#767577', true: '#a5b4fc' }}
            thumbColor={project.completed ? '#f5dd4b' : '#f4f3f4'}
          />
        </View>
      </LinearGradient>

      {/* Scrollable content with platform-specific adjustments */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.scrollContainer, { marginTop: scrollContainerMarginTop }]}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={fetchProject}
              tintColor={Colors.light.primary}
            />
          }
        >
          {/* Title and description inputs */}
          <View style={styles.inputsContainer}>
            <TextInput
              style={styles.titleInput}
              placeholder="Project Title"
              placeholderTextColor={Colors.light.textSecondary}
              value={project.title}
              onChangeText={(text) => handleUpdateField('title', text)}
              maxLength={50}
            />
            
            <TextInput
              style={styles.descriptionInput}
              placeholder="Project Description"
              placeholderTextColor={Colors.light.textSecondary}
              value={project.description}
              onChangeText={(text) => handleUpdateField('description', text)}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.contentContainer}>
            {/* Timeline section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Project Timeline</Text>
              
              <View style={styles.dateTimeGroup}>
                <Text style={styles.dateLabel}>Start</Text>
                <View style={styles.dateTimeRow}>
                  {renderDateTimeButton('startDate', project.start_date)}
                  {renderDateTimeButton('startTime', project.start_time, false)}
                </View>
              </View>
              
              <View style={styles.dateTimeGroup}>
                <Text style={styles.dateLabel}>End</Text>
                <View style={styles.dateTimeRow}>
                  {renderDateTimeButton('endDate', project.end_date)}
                  {renderDateTimeButton('endTime', project.end_time, false)}
                </View>
              </View>

              {renderDateTimePicker('startDate', project.start_date, 'date')}
              {renderDateTimePicker('startTime', project.start_time, 'time')}
              {renderDateTimePicker('endDate', project.end_date, 'date')}
              {renderDateTimePicker('endTime', project.end_time, 'time')}
            </View>

            {/* Category section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category</Text>
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                data={categories}
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder="Select category"
                value={project.category}
                onChange={(item) => handleUpdateField('category', item.value)}
                renderRightIcon={() => (
                  <Ionicons name="chevron-down" size={20} color={Colors.light.textSecondary} />
                )}
              />
            </View>

            {/* Phases section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Project Phases</Text>
                <TouchableOpacity 
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCurrentPhase({
                      name: '',
                      start_date: new Date(),
                      end_date: new Date(),
                      start_time: new Date(),
                      end_time: new Date(),
                      comment: '',
                      completed: false
                    });
                    setPhaseIndex(null);
                    setIsPhaseModalVisible(true);
                  }}
                  style={styles.addButton}
                >
                  <LinearGradient
                    colors={['#6a11cb', '#2575fc']}
                    style={styles.gradientButtonSmall}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="add" size={24} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              
              {project.phases.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="list" size={40} color={Colors.light.textSecondary} />
                  <Text style={styles.emptyText}>No phases added yet</Text>
                </View>
              ) : (
                project.phases.map(renderPhaseItem)
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Phase modal */}
      <Modal
        visible={isPhaseModalVisible}
        animationType="slide"
        transparent
        onRequestClose={resetPhaseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: height * 0.8 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {phaseIndex !== null ? 'Edit Phase' : 'Add New Phase'}
              </Text>
              <TouchableOpacity onPress={resetPhaseModal}>
                <Ionicons name="close" size={24} color={Colors.light.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <TextInput
                style={styles.modalInput}
                placeholder="Phase Name"
                placeholderTextColor={Colors.light.textSecondary}
                value={currentPhase?.name || ''}
                onChangeText={(text) => setCurrentPhase(prev => prev ? { ...prev, name: text } : null)}
              />

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>Start Date & Time</Text>
                <View style={styles.modalDateTimeRow}>
                  <TouchableOpacity
                    style={styles.modalDateInput}
                    onPress={() => setShowPicker(prev => ({ ...prev, phaseStartDate: true }))}
                  >
                    <Text style={styles.modalDateText}>
                      {currentPhase?.start_date.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalDateInput}
                    onPress={() => setShowPicker(prev => ({ ...prev, phaseStartTime: true }))}
                  >
                    <Text style={styles.modalDateText}>
                      {currentPhase?.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>End Date & Time</Text>
                <View style={styles.modalDateTimeRow}>
                  <TouchableOpacity
                    style={styles.modalDateInput}
                    onPress={() => setShowPicker(prev => ({ ...prev, phaseEndDate: true }))}
                  >
                    <Text style={styles.modalDateText}>
                      {currentPhase?.end_date.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalDateInput}
                    onPress={() => setShowPicker(prev => ({ ...prev, phaseEndTime: true }))}
                  >
                    <Text style={styles.modalDateText}>
                      {currentPhase?.end_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {renderDateTimePicker('phaseStartDate', currentPhase?.start_date || new Date(), 'date')}
              {renderDateTimePicker('phaseStartTime', currentPhase?.start_time || new Date(), 'time')}
              {renderDateTimePicker('phaseEndDate', currentPhase?.end_date || new Date(), 'date')}
              {renderDateTimePicker('phaseEndTime', currentPhase?.end_time || new Date(), 'time')}

              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Additional Comments (Optional)"
                placeholderTextColor={Colors.light.textSecondary}
                multiline
                value={currentPhase?.comment || ''}
                onChangeText={(text) => setCurrentPhase(prev => prev ? { ...prev, comment: text } : null)}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={resetPhaseModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={handlePhaseSubmit}
              >
                <LinearGradient
                  colors={['#6a11cb', '#2575fc']}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.saveButtonText}>
                    {phaseIndex !== null ? 'Update' : 'Add'} Phase
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fixedHeader: {
    paddingHorizontal: 24,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    paddingTop: 40,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  inputsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.textPrimary,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.lightGray,
    marginBottom: 12,
  },
  descriptionInput: {
    fontSize: 16,
    color: Colors.light.textPrimary,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.lightGray,
  },
  contentContainer: {
    backgroundColor: '#fff',
  },
  section: {
    marginBottom: 30,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  addButton: {
    overflow: 'hidden',
    borderRadius: 18,
  },
  gradientButtonSmall: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateTimeGroup: {
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
  },
  dateText: {
    fontSize: 16,
    color: Colors.light.textPrimary,
  },
  dropdown: {
    height: 50,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
  },
  placeholderStyle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  selectedTextStyle: {
    fontSize: 16,
    color: Colors.light.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 10,
  },
  phaseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.lightGray,
  },
  phaseInfo: {
    flex: 1,
    marginRight: 12,
  },
  phaseName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.textPrimary,
    marginBottom: 4,
  },
  phaseDates: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  phaseTimes: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.lightGray,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  modalContent: {
    padding: 20,
  },
  modalInput: {
    fontSize: 16,
    padding: 14,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
    marginBottom: 16,
    color: Colors.light.textPrimary,
  },
  modalTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  modalDateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalDateInput: {
    flex: 1,
    padding: 14,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
  },
  modalDateText: {
    fontSize: 16,
    color: Colors.light.textPrimary,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: Colors.light.background,
    marginRight: 12,
  },
  cancelButtonText: {
    color: Colors.light.textPrimary,
    fontWeight: '600',
    padding: 14,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: Colors.light.primary,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    padding: 14,
    textAlign: 'center',
  },
  gradientButton: {
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default UpdateProject;