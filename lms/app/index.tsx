import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Dimensions,
  ImageBackground,
  StatusBar,
  TouchableOpacity
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

const Index = () => {
  const { width } = Dimensions.get('window');
  const isSmallDevice = width < 375;
  const router = useRouter();

  return (
    <ImageBackground 
      source={require('@/assets/images/indexImageBackground.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.contentContainer}>
          <Animated.View entering={FadeInUp.duration(800)} style={styles.titleContainer}>
            <Text style={[styles.title, isSmallDevice && styles.titleSmall]}>
              Life Management
            </Text>
            <Text style={[styles.title, isSmallDevice && styles.titleSmall]}>
              System
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(1000)} style={styles.subtitleContainer}>
            <Text style={styles.subtitle}>
              Your all-in-one solution for organizing tasks and boosting productivity
            </Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(600).duration(1000)} style={styles.buttonWrapper}>
            <TouchableOpacity 
              style={[styles.button, { width: width < 768 ? width * 0.8 : width * 0.4 }]}
              activeOpacity={0.8}
              onPress={() => router.push('/intro/LoginScreen')}
            >
              <LinearGradient
                colors={['#6a11cb', '#2575fc']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.buttonText}>Get Started</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  titleContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 10,
    lineHeight: 42,
  },
  titleSmall: {
    fontSize: 28,
    lineHeight: 36,
  },
  subtitleContainer: {
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 3,
  },
  buttonWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    borderRadius: 50,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 18,
  },
});

export default Index;