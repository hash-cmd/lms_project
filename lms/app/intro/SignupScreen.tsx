import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import API_BASE_URL from '@/constants/config/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SignupScreen = () => {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  
  const [errors, setErrors] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateField = (name, value) => {
    let error = '';
    switch (name) {
      case 'firstName':
      case 'lastName':
      case 'username':
        error = value.trim() ? '' : 'This field is required';
        break;
      case 'email':
        if (!value.trim()) error = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Invalid email format';
        break;
      case 'password':
        if (!value) error = 'Password is required';
        else if (value.length < 8) error = 'Password must be at least 8 characters';
        break;
      case 'confirmPassword':
        if (!value) error = 'Please confirm your password';
        else if (value !== form.password) error = 'Passwords do not match';
        break;
      default:
        break;
    }
    return error;
  };

  const handleChange = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const validateForm = () => {
    const newErrors = {
      firstName: validateField('firstName', form.firstName),
      lastName: validateField('lastName', form.lastName),
      username: validateField('username', form.username),
      email: validateField('email', form.email),
      password: validateField('password', form.password),
      confirmPassword: validateField('confirmPassword', form.confirmPassword),
    };
    
    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== '');
  };

  const handleSignUp = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix all errors before submitting');
      return;
    }
    
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          username: form.username.trim(),
          email: form.email.toLowerCase().trim(),
          password: form.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      Alert.alert(
        'Account Created',
        'Your account has been successfully created!',
        [{ 
          text: 'Continue', 
          onPress: () => router.replace('/intro/LoginScreen') 
        }]
      );

    } catch (error) {
      Alert.alert(
        'Registration Error',
        error.message || 'An error occurred during registration. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <View style={styles.contentContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join our community today</Text>
            </View>

            <View style={styles.formContainer}>
              {/* First Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput
                  style={[styles.input, errors.firstName && styles.inputError]}
                  placeholder="Enter your first name"
                  value={form.firstName}
                  onChangeText={(text) => handleChange('firstName', text)}
                />
                {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
              </View>

              {/* Last Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={[styles.input, errors.lastName && styles.inputError]}
                  placeholder="Enter your last name"
                  value={form.lastName}
                  onChangeText={(text) => handleChange('lastName', text)}
                />
                {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}
              </View>

              {/* Username */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  style={[styles.input, errors.username && styles.inputError]}
                  placeholder="Enter your username"
                  value={form.username}
                  onChangeText={(text) => handleChange('username', text)}
                  autoCapitalize="none"
                />
                {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="Enter your email"
                  value={form.email}
                  onChangeText={(text) => handleChange('email', text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={[styles.inputContainer, errors.password && styles.inputError]}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your password"
                    value={form.password}
                    onChangeText={(text) => handleChange('password', text)}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.passwordToggle}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#888"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={[styles.inputContainer, errors.confirmPassword && styles.inputError]}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Confirm your password"
                    value={form.confirmPassword}
                    onChangeText={(text) => handleChange('confirmPassword', text)}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.passwordToggle}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#888"
                    />
                  </TouchableOpacity>
                </View>
                {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
              </View>
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleSignUp}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#6a11cb', '#2575fc']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Sign Up</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.replace('/intro/LoginScreen')}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  contentContainer: {
    paddingVertical: 40,
    minHeight: SCREEN_HEIGHT - 100,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#6a11cb',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  formContainer: {
    width: '100%',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  input: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#333',
    fontSize: 16,
  },
  textInput: {
    flex: 1,
    height: '100%',
    color: '#333',
    fontSize: 16,
  },
  inputError: {
    borderColor: 'red',
  },
  passwordToggle: {
    padding: 8,
  },
  errorText: {
    fontSize: 12,
    color: 'red',
    marginTop: 4,
    marginLeft: 4,
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6a11cb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 24,
  },
  buttonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    color: '#888',
    fontSize: 14,
  },
  footerLink: {
    color: '#6a11cb',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
});

export default SignupScreen;