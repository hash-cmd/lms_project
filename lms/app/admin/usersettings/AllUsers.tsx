import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  Animated,
  TextInput,
  Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import AdminButtonPageTabs from '@/components/custom/AdminButtonPageTabs';
import API_BASE_URL from '@/constants/config/api';

const Colors = {
  light: {
    primary: '#6a11cb',
    secondary: '#2575fc',
    textPrimary: '#2d2d2d',
    textSecondary: '#6d6d6d',
    background: '#f8f9fa',
    lightGray: '#e9ecef',
    danger: '#dc3545',
    success: '#28a745',
    warning: '#ffc107',
    gray: '#adb5bd'
  }
};

interface User {
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

interface PaginationData {
  count: number;
  next: string | null;
  previous: string | null;
  current_page: number;
  total_pages: number;
}

const UserListWithSearch = () => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    count: 0,
    next: null,
    previous: null,
    current_page: 1,
    total_pages: 1
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const router = useRouter();
  const fabAnimation = useRef(new Animated.Value(0)).current;

  const filterUsers = useCallback((query: string) => {
    if (!query) {
      setFilteredUsers(allUsers);
      return;
    }
    
    const lowerCaseQuery = query.toLowerCase();
    const filtered = allUsers.filter(user => 
      (user.first_name && user.first_name.toLowerCase().includes(lowerCaseQuery)) ||
      (user.last_name && user.last_name.toLowerCase().includes(lowerCaseQuery)) ||
      user.username.toLowerCase().includes(lowerCaseQuery) ||
      user.email.toLowerCase().includes(lowerCaseQuery)
    );
    
    setFilteredUsers(filtered);
  }, [allUsers]);

  const fetchUsers = useCallback(async (page: number = 1, isRefreshing: boolean = false) => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) throw new Error('Authentication required');
      
      if (isRefreshing) setRefreshing(true);
      else if (page === 1) setLoading(true);
      else setIsLoadingMore(true);

      const response = await axios.get(`${API_BASE_URL}/admin/all-users/`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        params: { page }
      });

      const data = response.data;
      
      if (isRefreshing || page === 1) {
        setAllUsers(data.results || []);
        setFilteredUsers(data.results || []);
      } else {
        setAllUsers(prev => [...prev, ...(data.results || [])]);
      }
      
      setPagination({
        count: data.count || 0,
        next: data.next || null,
        previous: data.previous || null,
        current_page: page,
        total_pages: Math.ceil((data.count || 0) / (data.results?.length || 1))
      });
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, []);

  const onRefresh = useCallback(() => {
    fetchUsers(1, true);
  }, [fetchUsers]);

  const loadMoreUsers = useCallback(() => {
    if (pagination.next && !isLoadingMore && !loading && !refreshing) {
      fetchUsers(pagination.current_page + 1);
    }
  }, [pagination, isLoadingMore, loading, refreshing, fetchUsers]);

  const handleAddUser = () => {
    Haptics.selectionAsync();
    router.push('/admin/usersettings/NewUser');
  };

  const handleUserPress = useCallback((userId: number) => {
    Haptics.selectionAsync();
    router.push({
      pathname: '/admin/usersettings/UserDetails',
      params: { userId: userId.toString() }
    });
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    filterUsers(text);
  };

  const handleSearchSubmit = () => {
    Keyboard.dismiss();
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity 
      style={styles.userCard}
      onPress={() => handleUserPress(item.id)}
      activeOpacity={0.8}
    >
      <View style={styles.userInfoContainer}>
        {item.profile_picture_url ? (
          <Image 
            source={{ uri: item.profile_picture_url }} 
            style={[
              styles.avatarImage,
              !item.is_active && styles.inactiveAvatar
            ]}
          />
        ) : (
          <View style={[
            styles.avatarContainer,
            !item.is_active && styles.inactiveAvatar
          ]}>
            <Ionicons 
              name="person" 
              size={24} 
              color={item.is_active ? Colors.light.primary : Colors.light.gray} 
            />
          </View>
        )}
        
        <View style={styles.userDetails}>
          <View style={styles.nameContainer}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.first_name && item.last_name 
                ? `${item.first_name} ${item.last_name}`
                : item.username}
            </Text>
            {item.is_superuser && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminText}>Admin</Text>
              </View>
            )}
            {!item.is_active && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveText}>Inactive</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
          <Text style={styles.userStatus}>
            Joined {new Date(item.date_joined).toLocaleDateString()}
            {item.last_login && ` • Last login: ${new Date(item.last_login).toLocaleDateString()}`}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.light.gray} />
    </TouchableOpacity>
  );

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={48} color={Colors.light.gray} />
      <Text style={styles.emptyText}>
        {searchQuery ? 'No matching users found' : 'No users available'}
      </Text>
      {searchQuery ? (
        <TouchableOpacity 
          style={styles.clearSearchButton}
          onPress={() => {
            setSearchQuery('');
            setFilteredUsers(allUsers);
          }}
        >
          <Text style={styles.clearSearchText}>Clear search</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => fetchUsers(1)}
        >
          <LinearGradient
            colors={['#6a11cb', '#2575fc']}
            style={styles.gradientButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.retryButtonText}>Refresh</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color={Colors.light.danger} />
          <Text style={styles.errorText}>Error loading users</Text>
          <Text style={styles.errorSubText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => fetchUsers(1)}
          >
            <LinearGradient
              colors={['#6a11cb', '#2575fc']}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#f8f9fa', '#ffffff']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerText}>User Management</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={Colors.light.gray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              placeholderTextColor={Colors.light.gray}
              value={searchQuery}
              onChangeText={handleSearchChange}
              onSubmitEditing={handleSearchSubmit}
              autoCapitalize="none"
              returnKeyType="search"
              blurOnSubmit={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchQuery('');
                setFilteredUsers(allUsers);
              }}>
                <Ionicons name="close" size={18} color={Colors.light.gray} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCardWrapper}>
            <LinearGradient
              colors={['#6a11cb', '#2575fc']}
              style={styles.statCardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.statCardTitle}>Total Users</Text>
              <Text style={styles.statCardValue}>{pagination.count}</Text>
            </LinearGradient>
          </View>

          <View style={styles.statCardWrapper}>
            <LinearGradient
              colors={['#6a11cb', '#2575fc']}
              style={styles.statCardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.statCardTitle}>Active</Text>
              <Text style={styles.statCardValue}>
                {allUsers.filter(u => u.is_active).length}
              </Text>
            </LinearGradient>
          </View>

          <View style={styles.statCardWrapper}>
            <LinearGradient
              colors={['#6a11cb', '#2575fc']}
              style={styles.statCardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.statCardTitle}>Admins</Text>
              <Text style={styles.statCardValue}>
                {allUsers.filter(u => u.is_superuser).length}
              </Text>
            </LinearGradient>
          </View>
        </View>

        <FlatList
          data={filteredUsers}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.light.primary]}
              tintColor={Colors.light.primary}
            />
          }
          ListEmptyComponent={renderEmptyComponent}
          onEndReached={loadMoreUsers}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={Colors.light.primary} />
              </View>
            ) : pagination.current_page < pagination.total_pages ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>Swipe up to load more</Text>
              </View>
            ) : null
          }
          onScrollBeginDrag={() => {
            Animated.spring(fabAnimation, {
              toValue: 1,
              useNativeDriver: true,
              friction: 4
            }).start();
          }}
          onScrollEndDrag={() => {
            Animated.spring(fabAnimation, {
              toValue: 0,
              useNativeDriver: true,
              friction: 4
            }).start();
          }}
          scrollEventThrottle={16}
        />

        <Animated.View 
          style={[
            styles.fab,
            {
              transform: [{
                translateY: fabAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 100]
                })
              }]
            }
          ]}
        >
          <TouchableOpacity 
            onPress={handleAddUser}
            activeOpacity={0.8}
            style={styles.fabButton}
          >
            <LinearGradient
              colors={['#6a11cb', '#2575fc']}
              style={styles.fabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="add" size={28} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>
      <View style={styles.tabs}>
        <AdminButtonPageTabs />
      </View>
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
    padding: 20,
    paddingBottom: 12,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.textPrimary,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: Colors.light.textPrimary,
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statCardWrapper: {
    flex: 1,
    marginHorizontal: 4,
    aspectRatio: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: '#6a11cb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  statCardGradient: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    justifyContent: 'center',
  },
  statCardTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  statCardValue: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
    marginTop: 4,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.light.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  inactiveAvatar: {
    opacity: 0.6,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textPrimary,
    marginRight: 8,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  userStatus: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  adminBadge: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  adminText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  inactiveBadge: {
    backgroundColor: Colors.light.gray,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: Colors.light.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: Colors.light.danger,
    marginTop: 16,
    fontWeight: 'bold',
  },
  errorSubText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradientButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  clearSearchButton: {
    marginTop: 16,
    padding: 8,
  },
  clearSearchText: {
    color: Colors.light.primary,
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 24,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
    backgroundColor: '#fff',
  },
});

export default UserListWithSearch;