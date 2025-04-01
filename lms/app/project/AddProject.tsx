import React, { useState } from 'react';
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
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Dropdown } from 'react-native-element-dropdown';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import API_BASE_URL from '@/constants/config/api';

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

const AddProject = () => {
  // Main form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: new Date(),
    endDate: new Date(),
    startTime: new Date(),
    endTime: new Date(),
    category: null,
    phases: [],
  });

  const [errors, setErrors] = useState({
    title: false,
    category: false,
    phases: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Picker visibility
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

  // Phase modal state
  const [phaseModal, setPhaseModal] = useState({
    visible: false,
    editingIndex: null,
    name: '',
    startDate: new Date(),
    endDate: new Date(),
    startTime: new Date(),
    endTime: new Date(),
    comment: '',
  });

  const [phaseErrors, setPhaseErrors] = useState({
    name: false,
  });

  const categories = [
    { label: 'Work', value: 'work' },
    { label: 'Personal', value: 'personal' },
    { label: 'School', value: 'school' },
    { label: 'Business', value: 'business' },
    { label: 'Health', value: 'health' },
  ];

  const { width, height } = Dimensions.get('window');

  // Helper Functions
  const handlePicker = (type, value) => {
    setShowPicker(prev => ({ ...prev, [type]: value }));
  };

  const validateDates = (start, end) => {
    if (start > end) {
      Alert.alert('Invalid Date', 'Start date cannot be after end date.');
      return false;
    }
    return true;
  };

  // Format date and time for Django backend
  const formatDate = (date) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const formatTime = (time) => {
    const t = new Date(time);
    return t.toTimeString().slice(0, 5); // HH:MM
  };

  // Form Handlers
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleDateTimeChange = (type, date) => {
    if (date) {
      handleInputChange(type, date);
    }
    handlePicker(type, false);
  };

  // Validation Functions
  const validateForm = () => {
    const newErrors = {
      title: !formData.title.trim(),
      category: !formData.category,
      phases: formData.phases.length === 0,
    };

    setErrors(newErrors);

    return !Object.values(newErrors).some(error => error);
  };

  const validatePhaseForm = () => {
    const newErrors = {
      name: !phaseModal.name.trim(),
    };

    setPhaseErrors(newErrors);

    return !Object.values(newErrors).some(error => error);
  };

  const validatePhaseDates = (phaseStartDate, phaseEndDate, phaseStartTime, phaseEndTime) => {
    const projectStart = new Date(formData.startDate);
    projectStart.setHours(formData.startTime.getHours(), formData.startTime.getMinutes());
    
    const projectEnd = new Date(formData.endDate);
    projectEnd.setHours(formData.endTime.getHours(), formData.endTime.getMinutes());
    
    const phaseStart = new Date(phaseStartDate);
    phaseStart.setHours(phaseStartTime.getHours(), phaseStartTime.getMinutes());
    
    const phaseEnd = new Date(phaseEndDate);
    phaseEnd.setHours(phaseEndTime.getHours(), phaseEndTime.getMinutes());

    if (phaseStart < projectStart || phaseEnd > projectEnd) {
      Alert.alert('Invalid Phase Dates', 'Phase must be within project timeframe.');
      return false;
    }

    if (phaseStart > phaseEnd) {
      Alert.alert('Invalid Date', 'Phase start cannot be after phase end.');
      return false;
    }

    return true;
  };

  // Project Submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!validateDates(formData.startDate, formData.endDate)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsSubmitting(true);

    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        Alert.alert('Error', 'Please log in again.');
        return;
      }

      // Prepare data for Django backend
      const projectData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        start_date: formatDate(formData.startDate),
        end_date: formatDate(formData.endDate),
        start_time: formatTime(formData.startTime),
        end_time: formatTime(formData.endTime),
        phases: formData.phases.map(phase => ({
          name: phase.name,
          start_date: formatDate(phase.startDate),
          end_date: formatDate(phase.endDate),
          start_time: formatTime(phase.startTime),
          end_time: formatTime(phase.endTime),
          comment: phase.comment || '',
          completed: false,
        })),
      };

      const response = await axios.post(
        `${API_BASE_URL}/projects/create/`,
        projectData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (response.status === 201) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Success', 
          'Project created successfully!', 
          [{ text: 'OK', onPress: () => router.replace('/project/Projects') }]
        );
      }
    } catch (error) {
      console.error('Project creation error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      let errorMessage = 'Failed to create project';
      if (error.response) {
        if (error.response.data) {
          errorMessage = JSON.stringify(error.response.data);
        } else if (error.response.status === 401) {
          errorMessage = 'Session expired. Please log in again.';
        }
      }

      Alert.alert('Error', errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Phase Functions
  const openPhaseModal = (index = null) => {
    if (index !== null) {
      const phase = formData.phases[index];
      setPhaseModal({
        visible: true,
        editingIndex: index,
        name: phase.name,
        startDate: new Date(phase.startDate),
        endDate: new Date(phase.endDate),
        startTime: new Date(`1970-01-01T${phase.startTime}:00`),
        endTime: new Date(`1970-01-01T${phase.endTime}:00`),
        comment: phase.comment || '',
      });
    } else {
      setPhaseModal({
        visible: true,
        editingIndex: null,
        name: '',
        startDate: new Date(),
        endDate: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        comment: '',
      });
    }
    setPhaseErrors({ name: false });
  };

  const closePhaseModal = () => {
    setPhaseModal(prev => ({ ...prev, visible: false }));
  };

  const handlePhaseInputChange = (field, value) => {
    setPhaseModal(prev => ({ ...prev, [field]: value }));
    if (phaseErrors[field]) {
      setPhaseErrors(prev => ({ ...prev, [field]: false }));
    }
  };

  const savePhase = () => {
    if (!validatePhaseForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!validatePhaseDates(
      phaseModal.startDate, 
      phaseModal.endDate,
      phaseModal.startTime,
      phaseModal.endTime
    )) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    const newPhase = {
      name: phaseModal.name,
      startDate: phaseModal.startDate,
      endDate: phaseModal.endDate,
      startTime: formatTime(phaseModal.startTime),
      endTime: formatTime(phaseModal.endTime),
      comment: phaseModal.comment || '',
      completed: false,
    };

    if (phaseModal.editingIndex !== null) {
      const updatedPhases = [...formData.phases];
      updatedPhases[phaseModal.editingIndex] = newPhase;
      handleInputChange('phases', updatedPhases);
    } else {
      handleInputChange('phases', [...formData.phases, newPhase]);
    }

    closePhaseModal();
    setErrors(prev => ({ ...prev, phases: false }));
  };

  const removePhase = (index) => {
    const updatedPhases = formData.phases.filter((_, i) => i !== index);
    handleInputChange('phases', updatedPhases);
    setErrors(prev => ({ ...prev, phases: updatedPhases.length === 0 }));
  };

  // Render Components
  const renderDateTimeButton = (type, value, isDate = true) => (
    <TouchableOpacity
      onPress={() => handlePicker(type, true)}
      style={[
        styles.dateButton,
        { borderColor: errors[type] ? Colors.light.error : Colors.light.lightGray }
      ]}
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

  const renderDateTimePicker = (type, value, mode, onChange) => (
    showPicker[type] && (
      <DateTimePicker
        value={value}
        mode={mode}
        display="spinner"
        onChange={(_, date) => onChange(type, date)}
      />
    )
  );

  const renderPhaseItem = (phase, index) => (
    <View key={index} style={styles.phaseItem}>
      <View style={styles.phaseInfo}>
        <Text style={styles.phaseName} numberOfLines={1}>{phase.name}</Text>
        <Text style={styles.phaseDates}>
          {new Date(phase.startDate).toLocaleDateString()} - {new Date(phase.endDate).toLocaleDateString()}
        </Text>
        <Text style={styles.phaseTimes}>
          {phase.startTime} - {phase.endTime}
        </Text>
      </View>
      <View style={styles.phaseActions}>
        <TouchableOpacity 
          onPress={() => openPhaseModal(index)}
          style={styles.phaseActionButton}
        >
          <Ionicons name="pencil" size={20} color={Colors.light.primary} />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => removePhase(index)}
          style={styles.phaseActionButton}
        >
          <Ionicons name="trash" size={20} color="#ff4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header */}
      <LinearGradient
        colors={['#6a11cb', '#2575fc']}
        style={styles.fixedHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Create New Project</Text>
        </View>
      </LinearGradient>

      {/* Scrollable Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.scrollContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title and Description Inputs */}
          <View style={styles.inputsContainer}>
            <TextInput
              style={[
                styles.titleInput,
                errors.title && { borderBottomColor: Colors.light.error }
              ]}
              placeholder="Project Title *"
              placeholderTextColor={Colors.light.textSecondary}
              value={formData.title}
              onChangeText={(text) => handleInputChange('title', text)}
              maxLength={50}
            />
            
            <TextInput
              style={styles.descriptionInput}
              placeholder="Project Description"
              placeholderTextColor={Colors.light.textSecondary}
              value={formData.description}
              onChangeText={(text) => handleInputChange('description', text)}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.contentContainer}>
            {/* Date & Time Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Project Timeline</Text>
              
              <View style={styles.dateTimeGroup}>
                <Text style={styles.dateLabel}>Start</Text>
                <View style={styles.dateTimeRow}>
                  {renderDateTimeButton('startDate', formData.startDate)}
                  {renderDateTimeButton('startTime', formData.startTime, false)}
                </View>
              </View>
              
              <View style={styles.dateTimeGroup}>
                <Text style={styles.dateLabel}>End</Text>
                <View style={styles.dateTimeRow}>
                  {renderDateTimeButton('endDate', formData.endDate)}
                  {renderDateTimeButton('endTime', formData.endTime, false)}
                </View>
              </View>

              {renderDateTimePicker('startDate', formData.startDate, 'date', 
                (type, date) => handleDateTimeChange('startDate', date))}
              {renderDateTimePicker('startTime', formData.startTime, 'time', 
                (type, time) => handleDateTimeChange('startTime', time))}
              {renderDateTimePicker('endDate', formData.endDate, 'date', 
                (type, date) => handleDateTimeChange('endDate', date))}
              {renderDateTimePicker('endTime', formData.endTime, 'time', 
                (type, time) => handleDateTimeChange('endTime', time))}
            </View>

            {/* Category Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category *</Text>
              <Dropdown
                style={[
                  styles.dropdown,
                  errors.category && { borderColor: Colors.light.error }
                ]}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                data={categories}
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder="Select category"
                value={formData.category}
                onChange={(item) => handleInputChange('category', item.value)}
                renderRightIcon={() => (
                  <Ionicons name="chevron-down" size={20} color={Colors.light.textSecondary} />
                )}
              />
              {errors.category && (
                <Text style={styles.errorText}>Please select a category</Text>
              )}
            </View>

            {/* Phases Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Project Phases *</Text>
                <TouchableOpacity 
                  onPress={() => openPhaseModal()}
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
              
              {formData.phases.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="list" size={40} color={Colors.light.textSecondary} />
                  <Text style={[styles.emptyText, errors.phases && { color: Colors.light.error }]}>
                    {errors.phases ? 'Please add at least one phase' : 'No phases added yet'}
                  </Text>
                </View>
              ) : (
                formData.phases.map(renderPhaseItem)
              )}
            </View>

            {/* Create Button */}
            <View style={styles.createButtonContainer}>
              <TouchableOpacity 
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <LinearGradient
                  colors={['#6a11cb', '#2575fc']}
                  style={styles.createButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.createButtonText}>Create Project</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Phase Modal */}
      <Modal
        visible={phaseModal.visible}
        animationType="slide"
        transparent
        onRequestClose={closePhaseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {phaseModal.editingIndex !== null ? 'Edit Phase' : 'Add New Phase'}
              </Text>
              <TouchableOpacity onPress={closePhaseModal}>
                <Ionicons name="close" size={24} color={Colors.light.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <TextInput
                style={[
                  styles.modalInput,
                  phaseErrors.name && { borderColor: Colors.light.error }
                ]}
                placeholder="Phase Name *"
                placeholderTextColor={Colors.light.textSecondary}
                value={phaseModal.name}
                onChangeText={(text) => handlePhaseInputChange('name', text)}
              />
              {phaseErrors.name && (
                <Text style={styles.errorText}>Please provide a phase name</Text>
              )}

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>Start Date & Time</Text>
                <View style={styles.modalDateTimeRow}>
                  <TouchableOpacity
                    style={styles.modalDateInput}
                    onPress={() => handlePicker('phaseStartDate', true)}
                  >
                    <Text style={styles.modalDateText}>
                      {phaseModal.startDate.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalDateInput}
                    onPress={() => handlePicker('phaseStartTime', true)}
                  >
                    <Text style={styles.modalDateText}>
                      {phaseModal.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>End Date & Time</Text>
                <View style={styles.modalDateTimeRow}>
                  <TouchableOpacity
                    style={styles.modalDateInput}
                    onPress={() => handlePicker('phaseEndDate', true)}
                  >
                    <Text style={styles.modalDateText}>
                      {phaseModal.endDate.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalDateInput}
                    onPress={() => handlePicker('phaseEndTime', true)}
                  >
                    <Text style={styles.modalDateText}>
                      {phaseModal.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {renderDateTimePicker('phaseStartDate', phaseModal.startDate, 'date', 
                (type, date) => handlePhaseInputChange('startDate', date))}
              {renderDateTimePicker('phaseStartTime', phaseModal.startTime, 'time', 
                (type, time) => handlePhaseInputChange('startTime', time))}
              {renderDateTimePicker('phaseEndDate', phaseModal.endDate, 'date', 
                (type, date) => handlePhaseInputChange('endDate', date))}
              {renderDateTimePicker('phaseEndTime', phaseModal.endTime, 'time', 
                (type, time) => handlePhaseInputChange('endTime', time))}

              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Additional Comments (Optional)"
                placeholderTextColor={Colors.light.textSecondary}
                multiline
                value={phaseModal.comment}
                onChangeText={(text) => handlePhaseInputChange('comment', text)}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={closePhaseModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={savePhase}
              >
                <LinearGradient
                  colors={['#6a11cb', '#2575fc']}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.saveButtonText}>
                    {phaseModal.editingIndex !== null ? 'Update' : 'Add'} Phase
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
  fixedHeader: {
    height: 120,
    paddingTop: 40,
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
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    
  },
  headerTitle: {
    paddingVertical: 30,
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 80,
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
  errorText: {
    fontSize: 14,
    color: Colors.light.error,
    marginTop: 4,
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
  phaseActions: {
    flexDirection: 'row',
  },
  phaseActionButton: {
    padding: 8,
    marginLeft: 8,
  },
  createButtonContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  createButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 18,
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
    maxHeight: '80%',
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

export default AddProject;