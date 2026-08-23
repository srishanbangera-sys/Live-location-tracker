import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Switch,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';

const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TRACKER';
const DEFAULT_SERVER_URL = 'https://core-pairs-street-others.trycloudflare.com';

// ------------------------------------------------------------------
// GLOBAL BACKGROUND TASK (Runs in OS Kernel even when App is closed)
// ------------------------------------------------------------------
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
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

        // Post location to server endpoint
        await fetch(`${savedUrl}/weather`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: targetId, lat, lng })
        });

        // Store latest point for UI display
        const now = new Date().toLocaleTimeString();
        await AsyncStorage.setItem('@last_location', JSON.stringify({ lat, lng, time: now }));

        // Increment background counter
        const currentCountStr = await AsyncStorage.getItem('@bg_count');
        const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;
        await AsyncStorage.setItem('@bg_count', (currentCount + 1).toString());
      } catch (err) {
        console.log('Background transmission error:', err);
      }
    }
  }
});

export default function App() {
  const [isTracking, setIsTracking] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [targetId, setTargetId] = useState('');
  const [locationData, setLocationData] = useState(null);
  const [streamCount, setStreamCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      // 1. Get or generate Target ID
      let id = await AsyncStorage.getItem('@target_id');
      if (!id) {
        id = Math.random().toString(36).substring(2, 12);
        await AsyncStorage.setItem('@target_id', id);
      }
      setTargetId(id);

      // 2. Get saved Server URL
      const savedUrl = await AsyncStorage.getItem('@server_url');
      if (savedUrl) setServerUrl(savedUrl);

      // 3. Check if background tracking task is currently running
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      setIsTracking(hasStarted);

      // 4. Connect WebSocket for foreground streaming
      connectSocket(savedUrl || DEFAULT_SERVER_URL);

      addLog('App initialized successfully.');
    } catch (e) {
      addLog(`Initialization error: ${e.message}`);
    }
  };

  const connectSocket = (url) => {
    try {
      if (socket) socket.disconnect();
      const newSocket = io(url, {
        transports: ['websocket', 'polling']
      });
      setSocket(newSocket);
    } catch (e) {
      console.log('Socket connect error', e);
    }
  };

  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 15)]);
  };

  const saveServerUrl = async () => {
    try {
      let formattedUrl = serverUrl.trim();
      if (formattedUrl.endsWith('/')) {
        formattedUrl = formattedUrl.slice(0, -1);
      }
      await AsyncStorage.setItem('@server_url', formattedUrl);
      setServerUrl(formattedUrl);
      connectSocket(formattedUrl);
      Alert.alert('Success', 'Server URL saved and reconnected.');
      addLog(`Server URL set to: ${formattedUrl}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to save server URL.');
    }
  };

  const toggleTracking = async (value) => {
    setLoading(true);
    try {
      if (value) {
        // Request foreground permission
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          Alert.alert('Permission Required', 'Foreground location permission is required.');
          setLoading(false);
          return;
        }

        // Request background permission for 24/7 continuous tracking
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          Alert.alert(
            'Background Permission Required',
            'Please select "Allow all the time" in location settings to enable 24/7 continuous background tracking.'
          );
        }

        // Start background location updates (runs continuously in OS Kernel)
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 1, // trigger every 1 meter move
          deferredUpdatesInterval: 3000, // min interval between updates
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Live Telemetry Active',
            notificationBody: 'Streaming background GPS coordinates 24/7',
            notificationColor: '#06b6d4'
          }
        });

        setIsTracking(true);
        addLog('24/7 Continuous Background Tracking ENABLED.');
      } else {
        // Stop location updates
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (hasStarted) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
        setIsTracking(false);
        addLog('24/7 Background Tracking DISABLED.');
      }
    } catch (e) {
      Alert.alert('Error', `Tracking toggle failed: ${e.message}`);
      addLog(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const triggerForegroundFix = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission Denied', 'Location permission needed.');

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng, altitude, speed, accuracy } = loc.coords;

      setLocationData({ lat, lng, altitude, speed, accuracy, time: new Date().toLocaleTimeString() });
      setStreamCount((c) => c + 1);

      // Emit via WebSocket
      if (socket && socket.connected) {
        socket.emit('send-location', { id: targetId, lat, lng });
      }

      // HTTP POST fallback
      await fetch(`${serverUrl}/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetId, lat, lng })
      });

      addLog(`Manual Sync: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } catch (e) {
      Alert.alert('Sync Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header Bar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Location Tracer</Text>
            <Text style={styles.headerSubtitle}>Target ID: <Text style={styles.targetHighlight}>{targetId || 'Initializing...'}</Text></Text>
          </View>
          <View style={[styles.badge, isTracking ? styles.badgeActive : styles.badgeInactive]}>
            <View style={[styles.pulseDot, isTracking ? styles.pulseActive : styles.pulseInactive]} />
            <Text style={[styles.badgeText, isTracking ? styles.badgeTextActive : styles.badgeTextInactive]}>
              {isTracking ? '24/7 ACTIVE' : 'STOPPED'}
            </Text>
          </View>
        </View>

        {/* 24/7 Switch Card */}
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextContainer}>
              <Text style={styles.cardTitle}>24/7 Background Service</Text>
              <Text style={styles.cardDescription}>
                Streams location continuously even when app is closed or phone is rebooted.
              </Text>
            </View>
            {loading ? (
              <ActivityIndicator size="small" color="#06b6d4" />
            ) : (
              <Switch
                trackColor={{ false: '#334155', true: 'rgba(6, 182, 212, 0.4)' }}
                thumbColor={isTracking ? '#06b6d4' : '#94a3b8'}
                onValueChange={toggleTracking}
                value={isTracking}
              />
            )}
          </View>
        </View>

        {/* Telemetry Display Grid */}
        <View style={styles.grid}>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Latitude</Text>
            <Text style={styles.gridValue}>{locationData ? locationData.lat.toFixed(5) : '--'}</Text>
          </View>

          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Longitude</Text>
            <Text style={styles.gridValue}>{locationData ? locationData.lng.toFixed(5) : '--'}</Text>
          </View>

          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Altitude</Text>
            <Text style={styles.gridValue}>{locationData ? `${locationData.altitude?.toFixed(1) || 0}m` : '--'}</Text>
          </View>

          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Accuracy</Text>
            <Text style={styles.gridValue}>{locationData ? `±${locationData.accuracy?.toFixed(1) || 0}m` : '--'}</Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={triggerForegroundFix}
          activeOpacity={0.8}
          disabled={loading}
        >
          <Text style={styles.actionBtnText}>⚡ Force Sync Location Now</Text>
        </TouchableOpacity>

        {/* Server Config Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Server Endpoint URL</Text>
          <Text style={styles.cardDescription}>Backend or Cloudflare Tunnel server URL:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="https://your-tunnel.trycloudflare.com"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveServerUrl}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Background Event Log Feed */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>System Diagnostics & Log Feed</Text>
          <View style={styles.logBox}>
            {logs.length === 0 ? (
              <Text style={styles.emptyLog}>No event logs captured yet.</Text>
            ) : (
              logs.map((item, idx) => (
                <Text key={idx} style={styles.logText}>{item}</Text>
              ))
            )}
          </View>
        </View>

      </ScrollView>
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
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  targetHighlight: {
    color: '#06b6d4',
    fontWeight: '700',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  badgeInactive: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  pulseActive: {
    backgroundColor: '#06b6d4',
  },
  pulseInactive: {
    backgroundColor: '#94a3b8',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextActive: {
    color: '#06b6d4',
  },
  badgeTextInactive: {
    color: '#94a3b8',
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  gridCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  gridLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  actionBtn: {
    backgroundColor: '#06b6d4',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#06b6d4',
    fontWeight: '700',
    fontSize: 13,
  },
  logBox: {
    backgroundColor: '#090d16',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    maxHeight: 140,
  },
  emptyLog: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
  },
  logText: {
    color: '#06b6d4',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
});
