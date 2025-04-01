import React, { useCallback, useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
  Switch,
  Platform,
  Linking,
  Alert,
  Dimensions,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import {
  Ionicons,
  MaterialIcons,
  Feather,
  FontAwesome,
  MaterialCommunityIcons,
  AntDesign,
} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_BASE_URL from '@/constants/config/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';

const Settings = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [headerScrollY] = useState(new Animated.Value(0));
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const navigation = useNavigation();

  const { width } = Dimensions.get('window');

  // Animation Constants
  const HEADER_EXPANDED_HEIGHT = 240;
  const HEADER_COLLAPSED_HEIGHT = 80;
  const SCROLL_RANGE = 100;
  const TITLE_FADE_START = 0;
  const TITLE_FADE_END = 80;
  const PROFILE_FADE_END = 100;

  const headerHeight = headerScrollY.interpolate({
    inputRange: [0, SCROLL_RANGE],
    outputRange: [HEADER_EXPANDED_HEIGHT, HEADER_COLLAPSED_HEIGHT],
    extrapolate: 'clamp',
  });

  const headerTitleOpacity = headerScrollY.interpolate({
    inputRange: [TITLE_FADE_START, TITLE_FADE_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const profileOpacity = headerScrollY.interpolate({
    inputRange: [0, PROFILE_FADE_END],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    fetchProfile();
    checkBiometricSupport();
    loadLocalImage();
  }, []);

  const loadLocalImage = async () => {
    try {
      const uri = await AsyncStorage.getItem('localProfileImage');
      if (uri) {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          setLocalImageUri(uri);
        } else {
          await AsyncStorage.removeItem('localProfileImage');
        }
      }
    } catch (error) {
      console.error('Error loading local image:', error);
    }
  };

  const saveImageLocally = async (uri: string) => {
    try {
      const fileName = `profile_${Date.now()}.jpg`;
      const newPath = `${FileSystem.cacheDirectory}${fileName}`;
      
      await FileSystem.copyAsync({
        from: uri,
        to: newPath,
      });
      
      await AsyncStorage.setItem('localProfileImage', newPath);
      setLocalImageUri(newPath);
      return newPath;
    } catch (error) {
      console.error('Error saving image locally:', error);
      return null;
    }
  };

  const fetchProfile = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) return;
  
      const response = await axios.get(`${API_BASE_URL}/profile/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
  
      if (response.data) {
        setUserName(response.data.username || '');
        setUserEmail(response.data.email || '');
  
        const imageUrl = response.data.profile_picture_url || response.data.profile_picture;
        if (imageUrl) {
          let finalUrl;
          if (imageUrl.startsWith('http')) {
            finalUrl = imageUrl;
          } else {
            const cleanPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
            finalUrl = `${API_BASE_URL}/media/${cleanPath}`;
          }
          
          setSelectedImage(`${finalUrl}?t=${Date.now()}`);
        } else {
          setSelectedImage(null);
        }
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkBiometricSupport = async () => {
    setBiometricEnabled(true);
  };

  const pickImage = async () => {
    try {
      Haptics.selectionAsync();
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission required',
          'Please enable photo library access in settings'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setIsLoading(true);

        const manipulatedImage = await manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: SaveFormat.JPEG }
        );

        // Save to local storage first for immediate display
        const localPath = await saveImageLocally(manipulatedImage.uri);
        if (localPath) {
          setLocalImageUri(localPath);
        }

        // Then upload to server
        const uploadSuccess = await uploadProfilePicture(manipulatedImage.uri);

        if (uploadSuccess) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (err) {
      console.error('Image picker error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update profile picture');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadProfilePicture = async (uri: string): Promise<boolean> => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) return false;

      const formData = new FormData();
      const filename = uri.split('/').pop() || `profile_${Date.now()}.jpg`;
      
      formData.append('profile_picture', {
        uri: uri,
        name: filename,
        type: 'image/jpeg',
      } as any);

      const response = await axios.put(`${API_BASE_URL}/profile/`, formData, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      if (response.status === 200) {
        await fetchProfile();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert(
        'Upload Failed',
        'Could not update profile picture. Please try again.'
      );
      return false;
    }
  };

  const handleLogout = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      const [accessToken, refreshToken] = await Promise.all([
        AsyncStorage.getItem('accessToken'),
        AsyncStorage.getItem('refreshToken'),
      ]);

      if (!accessToken || !refreshToken) {
        throw new Error('Authentication tokens not found');
      }

      await fetch(`${API_BASE_URL}/logout/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user', 'localProfileImage']);
      router.replace('/intro/LoginScreen');
    } catch (err) {
      Alert.alert('Logout Error', 'Failed to logout. Please try again.');
      console.error('Logout error:', err);
    }
  }, [router]);

  const openExternalLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error('Failed to open URL:', err);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6a11cb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <LinearGradient
          colors={['#6a11cb', '#2575fc']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Animated.View
            style={[styles.profileContainer, { opacity: profileOpacity }]}
          >
            <TouchableOpacity
              style={styles.profilePictureWrapper}
              onPress={pickImage}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {localImageUri ? (
                <Image
                  source={{ uri: localImageUri }}
                  style={styles.profilePicture}
                  resizeMode="cover"
                  onError={() => {
                    console.log('Failed to load local profile image');
                    setLocalImageUri(null);
                  }}
                />
              ) : selectedImage ? (
                <Image
                  source={{ 
                    uri: selectedImage,
                    headers: {
                      Authorization: `Bearer ${AsyncStorage.getItem('accessToken')}`,
                    },
                    cache: 'reload'
                  }}
                  style={styles.profilePicture}
                  resizeMode="cover"
                  onError={() => {
                    console.log('Failed to load profile image');
                    setSelectedImage(null);
                  }}
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={40} color="white" />
                </View>
              )}
              <View style={styles.cameraIcon}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="camera" size={18} color="white" />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.profileName}>{userName || 'User'}</Text>
            <Text style={styles.profileEmail}>
              {userEmail || 'user@example.com'}
            </Text>
          </Animated.View>
          <Animated.Text
            style={[styles.headerTitle, { opacity: headerTitleOpacity }]}
          >
            Settings
          </Animated.Text>
        </LinearGradient>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContainer}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: headerScrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ACCOUNT</Text>
          <TouchableOpacity>
            <SettingItem
              icon={<MaterialIcons name="email" size={24} color="#6a11cb" />}
              title="Email Address"
              value={userEmail || 'Not set'}
              onPress={() => navigation.navigate('ChangeEmailScreen')}
            />
            </TouchableOpacity>
          <SettingItem
            icon={<Feather name="lock" size={24} color="#6a11cb" />}
            title="Password"
            value="••••••••"
            onPress={() => navigation.navigate('ChangePassword')}
          />
          <SettingItem
            icon={
              <MaterialCommunityIcons
                name="fingerprint"
                size={24}
                color="#6a11cb"
              />
            }
            title="Biometric Login"
            rightElement={
              <Switch
                value={biometricEnabled}
                onValueChange={(val) => {
                  Haptics.selectionAsync();
                  setBiometricEnabled(val);
                }}
                trackColor={{ false: '#e5e7eb', true: '#6a11cb' }}
                thumbColor="#ffffff"
              />
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PREFERENCES</Text>
          <SettingItem
            icon={<Ionicons name="moon" size={24} color="#6a11cb" />}
            title="Dark Mode"
            rightElement={
              <Switch
                value={darkMode}
                onValueChange={(val) => {
                  Haptics.selectionAsync();
                  setDarkMode(val);
                }}
                trackColor={{ false: '#e5e7eb', true: '#6a11cb' }}
                thumbColor="#ffffff"
              />
            }
          />
          <SettingItem
            icon={<Ionicons name="notifications" size={24} color="#6a11cb" />}
            title="Notifications"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={(val) => {
                  Haptics.selectionAsync();
                  setNotificationsEnabled(val);
                }}
                trackColor={{ false: '#e5e7eb', true: '#6a11cb' }}
                thumbColor="#ffffff"
              />
            }
          />
          <SettingItem
            icon={<Feather name="globe" size={24} color="#6a11cb" />}
            title="Language"
            value="English"
            onPress={() => navigation.navigate('LanguageSettings')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SUPPORT</Text>
          <SettingItem
            icon={<Ionicons name="help-circle" size={24} color="#6a11cb" />}
            title="Help Center"
            onPress={() => openExternalLink('https://expo.dev/support')}
          />
          <SettingItem
            icon={<FontAwesome name="legal" size={24} color="#6a11cb" />}
            title="Terms of Service"
            onPress={() => openExternalLink('https://expo.dev/terms#:~:text=Expo%20reserves%20the%20right%20at%20any%20time%20and%20from%20time,or%20discontinuance%20of%20the%20Service.')}
          />
          <SettingItem
            icon={
              <MaterialIcons name="privacy-tip" size={24} color="#6a11cb" />
            }
            title="Privacy Policy"
            onPress={() => openExternalLink('https://expo.dev/security#:~:text=End%2Duser%20data,PII%20related%20to%20your%20users.')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ABOUT</Text>
          <SettingItem
            icon={<AntDesign name="infocirlce" size={24} color="#6a11cb" />}
            title="Version"
            value="1.0.0"
          />
          <SettingItem
            icon={
              <MaterialIcons name="rate-review" size={24} color="#6a11cb" />
            }
            title="Rate App"
            onPress={() => {
              Haptics.selectionAsync();
              Alert.alert('Rate App', 'Would you like to rate this app?', [
                { text: 'Not Now' },
                {
                  text: 'Rate Now',
                  onPress: () => openExternalLink('https://apps.apple.com'),
                },
              ]);
            }}
          />
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const SettingItem = ({ icon, title, value, onPress, rightElement }: any) => (
  <TouchableOpacity
    style={styles.settingItem}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.7}
  >
    <View style={styles.settingIconContainer}>{icon}</View>
    <View style={styles.settingTextContainer}>
      <Text style={styles.settingTitle}>{title}</Text>
      {value && <Text style={styles.settingValue}>{value}</Text>}
    </View>
    {rightElement ? (
      rightElement
    ) : (
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    overflow: 'hidden',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  gradient: {
    flex: 1,
    paddingVertical: 40,
    alignItems: 'center',
  },
  profileContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  profilePictureWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  profilePicture: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#6a11cb',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileName: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  profileEmail: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  headerTitle: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 24 : 30,
    color: 'white',
    fontSize: 32,
    fontWeight: '600',
  },
  scrollContainer: {
    paddingTop: 30,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#111827',
  },
  settingValue: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Settings;