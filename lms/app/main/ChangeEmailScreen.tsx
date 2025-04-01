import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_BASE_URL from '@/constants/config/api';
import { Colors } from '@/constants/Colors';
import { useNavigation } from '@react-navigation/native';

const EmailViewScreen = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    const fetchCurrentEmail = async () => {
      try {
        const accessToken = await AsyncStorage.getItem('accessToken');
        if (!accessToken) return;

        const response = await axios.get(`${API_BASE_URL}/profile/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.data?.email) {
          setEmail(response.data.email);
        }
      } catch (err) {
        console.error('Error fetching current email:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentEmail();
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#f3f4f6', '#e5e7eb']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#6366f1" />
          </TouchableOpacity>
          <Text style={styles.title}>Your Email Address</Text>
        </View>

        <ScrollView contentContainerStyle={styles.contentContainer}>
          <View style={styles.infoContainer}>
            <Text style={styles.label}>Registered Email</Text>
            <View style={styles.emailContainer}>
              <Text style={styles.emailText}>{email}</Text>
            </View>
            
            <Text style={styles.note}>
              To change your email, please contact support.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
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
    paddingTop: 20,
  },
  infoContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
  },
  emailContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  emailText: {
    fontSize: 16,
    color: '#111827',
  },
  note: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default EmailViewScreen;