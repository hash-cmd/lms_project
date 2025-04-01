import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_BASE_URL from '@/constants/config/api';

const NewUserScreen = () => {
  const navigation = useNavigation();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    is_superuser: false
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    specialChar: false
  });

  const validatePassword = (password) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      specialChar: /[^A-Za-z0-9]/.test(password)
    };
    setPasswordRequirements(requirements);
    return Object.values(requirements).every(Boolean);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required';
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      newErrors.password = 'Password does not meet requirements';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) throw new Error('No access token found');

      const { confirmPassword, ...userData } = formData;

      const response = await axios.post(`${API_BASE_URL}/admin/new-user/`, userData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      Alert.alert(
        'Success', 
        'User created successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error creating user:', error);
      
      let errorMessage = 'Failed to create user';
      if (error.response?.data) {
        if (typeof error.response.data === 'object') {
          errorMessage = Object.entries(error.response.data)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join('\n');
        } else {
          errorMessage = error.response.data;
        }
      }
      
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    if (field === 'password') {
      validatePassword(value);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#6a11cb', '#2575fc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add New User</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={[styles.input, errors.first_name && styles.inputError]}
                placeholder="John"
                value={formData.first_name}
                onChangeText={(text) => handleChange('first_name', text)}
                autoCapitalize="words"
              />
              {errors.first_name && <Text style={styles.errorText}>{errors.first_name}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={[styles.input, errors.last_name && styles.inputError]}
                placeholder="Doe"
                value={formData.last_name}
                onChangeText={(text) => handleChange('last_name', text)}
                autoCapitalize="words"
              />
              {errors.last_name && <Text style={styles.errorText}>{errors.last_name}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={[styles.input, errors.username && styles.inputError]}
                placeholder="johndoe"
                value={formData.username}
                onChangeText={(text) => handleChange('username', text)}
                autoCapitalize="none"
              />
              {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="john@example.com"
                value={formData.email}
                onChangeText={(text) => handleChange('email', text)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                placeholder="••••••••"
                value={formData.password}
                onChangeText={(text) => handleChange('password', text)}
                secureTextEntry
              />
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              
              <View style={styles.passwordRequirements}>
                <Text style={styles.requirementsTitle}>Password must contain:</Text>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name={passwordRequirements.length ? 'checkmark-circle' : 'close-circle'} 
                    size={16} 
                    color={passwordRequirements.length ? '#10b981' : '#ef4444'} 
                  />
                  <Text style={styles.requirementText}>At least 8 characters</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name={passwordRequirements.uppercase ? 'checkmark-circle' : 'close-circle'} 
                    size={16} 
                    color={passwordRequirements.uppercase ? '#10b981' : '#ef4444'} 
                  />
                  <Text style={styles.requirementText}>1 uppercase letter</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name={passwordRequirements.lowercase ? 'checkmark-circle' : 'close-circle'} 
                    size={16} 
                    color={passwordRequirements.lowercase ? '#10b981' : '#ef4444'} 
                  />
                  <Text style={styles.requirementText}>1 lowercase letter</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name={passwordRequirements.number ? 'checkmark-circle' : 'close-circle'} 
                    size={16} 
                    color={passwordRequirements.number ? '#10b981' : '#ef4444'} 
                  />
                  <Text style={styles.requirementText}>1 number</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name={passwordRequirements.specialChar ? 'checkmark-circle' : 'close-circle'} 
                    size={16} 
                    color={passwordRequirements.specialChar ? '#10b981' : '#ef4444'} 
                  />
                  <Text style={styles.requirementText}>1 special character</Text>
                </View>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={[styles.input, errors.confirmPassword && styles.inputError]}
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChangeText={(text) => handleChange('confirmPassword', text)}
                secureTextEntry
              />
              {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
            </View>

            <TouchableOpacity 
              style={styles.adminToggle}
              onPress={() => handleChange('is_superuser', !formData.is_superuser)}
            >
              <LinearGradient
                colors={formData.is_superuser ? ['#6a11cb', '#2575fc'] : ['#e5e7eb', '#f3f4f6']}
                style={styles.toggleContainer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={[
                  styles.toggleCircle,
                  formData.is_superuser && styles.toggleCircleActive
                ]}>
                  <Ionicons 
                    name={formData.is_superuser ? 'checkmark' : 'close'} 
                    size={16} 
                    color={formData.is_superuser ? 'white' : '#9ca3af'} 
                  />
                </View>
              </LinearGradient>
              <Text style={styles.adminLabel}>Administrator Privileges</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleSubmit}
            disabled={loading}
          >
            <LinearGradient
              colors={['#6a11cb', '#2575fc']}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitButtonText}>Create User</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? 20 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
  },
  container: {
    padding: 16,
    paddingTop: 24,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  passwordRequirements: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#334155',
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  requirementText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#64748b',
  },
  adminToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  toggleContainer: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
    marginRight: 12,
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  adminLabel: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  submitButton: {
    borderRadius: 8,
    overflow: 'hidden',
    height: 50,
    ...Platform.select({
      ios: {
        shadowColor: '#6a11cb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  gradientButton: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NewUserScreen;