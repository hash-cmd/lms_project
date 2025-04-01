import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput,
  StyleSheet, 
  ActivityIndicator, 
  ScrollView, 
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  SafeAreaView
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import API_BASE_URL from '@/constants/config/api';

const { height, width } = Dimensions.get('window');

interface UserDetails {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  profile_picture_url: string | null;
  date_joined: string;
  is_superuser: boolean;
  is_active: boolean;
  last_login: string | null;
}

const UserDetailsScreen = () => {
  const { userId } = useLocalSearchParams();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [editableUser, setEditableUser] = useState<Partial<UserDetails>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('Authentication required');
      }
      
      const response = await axios.get(
        `${API_BASE_URL}/admin/user/${userId}/`, 
        {
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setUser(response.data);
      setEditableUser(response.data);
    } catch (err: any) {
      let errorMessage = 'Failed to fetch user details';
      if (err.response) {
        if (err.response.status === 404) {
          errorMessage = 'User not found';
        } else if (err.response.status === 403) {
          errorMessage = 'You do not have permission to view this user';
        } else if (err.response.data?.error) {
          errorMessage = err.response.data.error;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (isEditing) {
      setEditableUser(user || {});
    }
  };

  const handleInputChange = (field: keyof UserDetails, value: string) => {
    setEditableUser(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      if (!user) return;
      
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('Authentication required');
      }
      
      const response = await axios.patch(
        `${API_BASE_URL}/admin/user/${userId}/`,
        editableUser,
        {
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setUser(response.data);
      setEditableUser(response.data);
      setIsEditing(false);
      Alert.alert('Success', 'User details updated successfully');
    } catch (err: any) {
      Alert.alert(
        'Error', 
        err.response?.data?.error || err.message || 'Failed to update user details'
      );
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to permanently delete this user account?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const accessToken = await AsyncStorage.getItem('accessToken');
              if (!accessToken) throw new Error('Authentication required');
              
              await axios.delete(
                `${API_BASE_URL}/admin/user/${userId}/`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
              );
              
              Alert.alert('Success', 'User deleted successfully');
              router.back();
            } catch (err: any) {
              Alert.alert(
                'Error', 
                err.response?.data?.error || err.message || 'Failed to delete user'
              );
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async () => {
    try {
      if (!user) return;
      
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) throw new Error('Authentication required');
      
      const response = await axios.patch(
        `${API_BASE_URL}/admin/user/${userId}/`,
        { is_active: !user.is_active },
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      
      setUser(response.data);
      setEditableUser(response.data);
      Alert.alert(
        'Success', 
        `User has been ${user.is_active ? 'deactivated' : 'activated'}`
      );
    } catch (err: any) {
      Alert.alert(
        'Error', 
        err.response?.data?.error || err.message || 'Failed to update user status'
      );
    }
  };

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6a11cb" />
          <Text style={styles.loadingText}>Loading user details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#dc3545" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchUserDetails}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Ionicons name="person-remove" size={48} color="#6a11cb" />
          <Text style={styles.errorText}>User not found</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchUserDetails}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#6a11cb" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>User Details</Text>
          <TouchableOpacity onPress={handleEditToggle} style={styles.editButton}>
            <Ionicons 
              name={isEditing ? "close" : "create-outline"} 
              size={20} 
              color="#6a11cb" 
            />
          </TouchableOpacity>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              {user.profile_picture_url ? (
                <Image 
                  source={{ uri: user.profile_picture_url }} 
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={48} color="#6a11cb" />
                </View>
              )}
            </View>
            
            <View style={styles.statusBadges}>
              {user.is_superuser && (
                <View style={[styles.badge, styles.adminBadge]}>
                  <Text style={styles.badgeText}>Admin</Text>
                </View>
              )}
              {!user.is_active && (
                <View style={[styles.badge, styles.inactiveBadge]}>
                  <Text style={styles.badgeText}>Inactive</Text>
                </View>
              )}
            </View>
          </View>

          {/* User Details Form */}
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            
            <View style={styles.detailField}>
              <Ionicons name="person" size={20} color="#6a11cb" style={styles.fieldIcon} />
              {isEditing ? (
                <TextInput
                  style={styles.inputField}
                  value={editableUser.first_name || ''}
                  onChangeText={(text) => handleInputChange('first_name', text)}
                  placeholder="First Name"
                />
              ) : (
                <View style={styles.textField}>
                  <Text style={styles.fieldLabel}>First Name</Text>
                  <Text style={styles.fieldValue}>{user.first_name}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.detailField}>
              <Ionicons name="person" size={20} color="#6a11cb" style={styles.fieldIcon} />
              {isEditing ? (
                <TextInput
                  style={styles.inputField}
                  value={editableUser.last_name || ''}
                  onChangeText={(text) => handleInputChange('last_name', text)}
                  placeholder="Last Name"
                />
              ) : (
                <View style={styles.textField}>
                  <Text style={styles.fieldLabel}>Last Name</Text>
                  <Text style={styles.fieldValue}>{user.last_name}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.detailField}>
              <Ionicons name="at" size={20} color="#6a11cb" style={styles.fieldIcon} />
              {isEditing ? (
                <TextInput
                  style={styles.inputField}
                  value={editableUser.username || ''}
                  onChangeText={(text) => handleInputChange('username', text)}
                  placeholder="Username"
                />
              ) : (
                <View style={styles.textField}>
                  <Text style={styles.fieldLabel}>Username</Text>
                  <Text style={styles.fieldValue}>@{user.username}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.detailField}>
              <Ionicons name="mail" size={20} color="#6a11cb" style={styles.fieldIcon} />
              {isEditing ? (
                <TextInput
                  style={styles.inputField}
                  value={editableUser.email || ''}
                  onChangeText={(text) => handleInputChange('email', text)}
                  placeholder="Email"
                  keyboardType="email-address"
                />
              ) : (
                <View style={styles.textField}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <Text style={styles.fieldValue}>{user.email}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.detailField}>
              <Ionicons name="calendar" size={20} color="#6a11cb" style={styles.fieldIcon} />
              <View style={styles.textField}>
                <Text style={styles.fieldLabel}>Joined</Text>
                <Text style={styles.fieldValue}>
                  {new Date(user.date_joined).toLocaleDateString()}
                </Text>
              </View>
            </View>
            
            {user.last_login && (
              <View style={styles.detailField}>
                <Ionicons name="time" size={20} color="#6a11cb" style={styles.fieldIcon} />
                <View style={styles.textField}>
                  <Text style={styles.fieldLabel}>Last Login</Text>
                  <Text style={styles.fieldValue}>
                    {new Date(user.last_login).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          {!isEditing && (
            <>
              <TouchableOpacity 
                style={[
                  styles.toggleActiveButton, 
                  user.is_active ? styles.deactivateButton : styles.activateButton
                ]}
                onPress={handleToggleActive}
              >
                <Text style={styles.toggleActiveButtonText}>
                  {user.is_active ? 'Deactivate User' : 'Activate User'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={handleDelete}
              >
                <Text style={styles.deleteButtonText}>Delete User</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Save/Cancel Buttons (only visible when editing) */}
          {isEditing && (
            <View style={styles.editActions}>
              {/* <TouchableOpacity 
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleEditToggle}
              >
                <Text style={styles.actionButtonText}>Cancel</Text>
              </TouchableOpacity> */}
              <TouchableOpacity 
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.actionButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          )}
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#343a40',
  },
  editButton: {
    padding: 4,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#dc3545',
    textAlign: 'center',
    maxWidth: '80%',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6a11cb',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#6a11cb',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6a11cb',
  },
  statusBadges: {
    flexDirection: 'row',
    gap: 10,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  adminBadge: {
    backgroundColor: '#6a11cb',
  },
  inactiveBadge: {
    backgroundColor: '#dc3545',
  },
  badgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  detailsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#343a40',
    marginBottom: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  detailField: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  fieldIcon: {
    marginRight: 12,
    width: 24,
  },
  inputField: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#495057',
    backgroundColor: '#f8f9fa',
  },
  textField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 16,
    color: '#343a40',
    fontWeight: '500',
  },
  toggleActiveButton: {
    backgroundColor: '#ffc107',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  toggleActiveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#28a745',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  activateButton: {
    backgroundColor: '#28a745',
  },
  deactivateButton: {
    backgroundColor: '#ffc107',
  },
});

export default UserDetailsScreen;