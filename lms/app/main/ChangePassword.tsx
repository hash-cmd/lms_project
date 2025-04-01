import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_BASE_URL from '@/constants/config/api';
import { Colors } from '@/constants/Colors';
import { useNavigation } from '@react-navigation/native';

const ChangePasswordScreen = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigation = useNavigation();

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    try {
      setIsLoading(true);
      const accessToken = await AsyncStorage.getItem('accessToken');
      
      const response = await axios.post(
        `${API_BASE_URL}/update-password/`,
        {
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.status === 200) {
        Alert.alert('Success', 'Password changed successfully', [
          {
            text: 'OK',
            onPress: () => {
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              navigation.goBack();
            },
          },
        ]);
      }
    } catch (error: any) {
      console.error('Password change error:', error);
      let errorMessage = 'Failed to change password';
      
      if (error.response) {
        if (error.response.status === 400) {
          // Handle Django validation errors
          if (error.response.data.error) {
            if (Array.isArray(error.response.data.error)) {
              errorMessage = error.response.data.error.join('\n');
            } else {
              errorMessage = error.response.data.error;
            }
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message;
          }
        } else if (error.response.status === 401) {
          errorMessage = 'Session expired. Please login again.';
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#6366f1" />
          </TouchableOpacity>
          <Text style={styles.title}>Change Password</Text>
        </View>

        <ScrollView contentContainerStyle={styles.contentContainer}>
          <View style={styles.infoContainer}>
            <Text style={styles.note}>
              For security, please enter your current password and then your new password
            </Text>

            {/* Current Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Current Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  <Ionicons
                    name={showCurrentPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={Colors.light.tabIconDefault}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={Colors.light.tabIconDefault}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={Colors.light.tabIconDefault}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Password Requirements */}
            <View style={styles.requirementsContainer}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              <View style={styles.requirementItem}>
                <Ionicons
                  name={newPassword.length >= 8 ? 'checkmark-circle' : 'ellipse'}
                  size={16}
                  color={newPassword.length >= 8 ? Colors.light.primary : '#6b7280'}
                />
                <Text style={[
                  styles.requirementText,
                  newPassword.length >= 8 && styles.requirementMet
                ]}>
                  At least 8 characters
                </Text>
              </View>
              <View style={styles.requirementItem}>
                <Ionicons
                  name={/[A-Z]/.test(newPassword) ? 'checkmark-circle' : 'ellipse'}
                  size={16}
                  color={/[A-Z]/.test(newPassword) ? Colors.light.primary : '#6b7280'}
                />
                <Text style={[
                  styles.requirementText,
                  /[A-Z]/.test(newPassword) && styles.requirementMet
                ]}>
                  At least one uppercase letter
                </Text>
              </View>
              <View style={styles.requirementItem}>
                <Ionicons
                  name={/[0-9]/.test(newPassword) ? 'checkmark-circle' : 'ellipse'}
                  size={16}
                  color={/[0-9]/.test(newPassword) ? Colors.light.primary : '#6b7280'}
                />
                <Text style={[
                  styles.requirementText,
                  /[0-9]/.test(newPassword) && styles.requirementMet
                ]}>
                  At least one number
                </Text>
              </View>
            </View>

            {/* Gradient Button */}
            <LinearGradient
              colors={['#6a11cb', '#2575fc']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.gradientButton, isLoading && styles.buttonDisabled]}
            >
              <TouchableOpacity
                onPress={handlePasswordChange}
                disabled={isLoading}
                style={styles.buttonTouchable}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  contentContainer: {
    flexGrow: 1,
    padding: 20,
  },
  infoContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  note: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    height: 48,
    color: '#111827',
    paddingVertical: 12,
  },
  eyeIcon: {
    padding: 8,
  },
  requirementsContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  requirementText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  requirementMet: {
    color: '#111827',
    fontWeight: '500',
  },
  gradientButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 8,
  },
  buttonTouchable: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

export default ChangePasswordScreen;