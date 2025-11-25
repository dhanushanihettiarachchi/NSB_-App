import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { NSB_COLORS } from '@/styles/global';

export default function AdminDashboard() {
  // dummy values for now – later connect to API
  const totalBookings = 48;
  const pendingBookings = 7;
  const approvedBookings = 31;
  const rejectedBookings = 10;

  return (
    <View style={styles.screen}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace('/SignIn')}
      >
        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.heading}>Welcome back!</Text>
          <Text style={styles.subHeading}>
            Admin overview of NSB Circuit Bungalow reservations
          </Text>
        </View>

        {/* ===== COLORED STAT BOXES ===== */}
        <View style={styles.statsGrid}>
          {/* Confirmed */}
          <View style={[styles.statCard, styles.confirmedCard]}>
            <Text style={styles.statTitle}>Confirmed{'\n'}Bookings</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{approvedBookings}</Text>
              <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
            </View>
          </View>

          {/* Pending */}
          <View style={[styles.statCard, styles.pendingCard]}>
            <Text style={styles.statTitle}>Pending{'\n'}Requests</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{pendingBookings}</Text>
              <Ionicons name="time-outline" size={20} color="#ffffff" />
            </View>
          </View>

          {/* Rejected */}
          <View style={[styles.statCard, styles.rejectedCard]}>
            <Text style={styles.statTitle}>Rejected{'\n'}Requests</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{rejectedBookings}</Text>
              <Ionicons name="close-circle" size={20} color="#ffffff" />
            </View>
          </View>

          {/* Total */}
          <View style={[styles.statCard, styles.totalCard]}>
            <Text style={styles.statTitle}>Total{'\n'}Bookings</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{totalBookings}</Text>
              <Ionicons name="document-text-outline" size={20} color="#ffffff" />
            </View>
          </View>
        </View>

        {/* ===== MAIN ACTIONS (same “bottom part” idea) ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Main Actions</Text>

          {/* Manage Bungalows */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => console.log('Manage Bungalows pressed')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons
                name="home-outline"
                size={22}
                color={NSB_COLORS.gold}
              />
            </View>
            <View style={styles.actionTextWrapper}>
              <Text style={styles.actionTitle}>Manage Bungalows</Text>
              <Text style={styles.actionSubtitle}>
                Add or update circuit bungalows and room details.
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          {/* Approve Bookings */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => console.log('Approve Bookings pressed')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons
                name="clipboard-outline"
                size={22}
                color={NSB_COLORS.gold}
              />
            </View>
            <View style={styles.actionTextWrapper}>
              <Text style={styles.actionTitle}>Approve Bookings</Text>
              <Text style={styles.actionSubtitle}>
                Review and approve pending booking requests.
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          {/* Reports */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => console.log('Reports pressed')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons
                name="bar-chart-outline"
                size={22}
                color={NSB_COLORS.gold}
              />
            </View>
            <View style={styles.actionTextWrapper}>
              <Text style={styles.actionTitle}>View Reports</Text>
              <Text style={styles.actionSubtitle}>
                Check monthly usage and branch-wise booking trends.
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>National Savings Bank</Text>
          <Text style={styles.footerText}>Welfare Division</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const CARD_RADIUS = 18;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#00093A',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
    padding: 4,
  },
  header: {
    marginBottom: 20,
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  subHeading: {
    color: '#C5CAE9',
    fontSize: 12,
    marginTop: 4,
  },

  /* COLORED STATS GRID */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    borderRadius: CARD_RADIUS,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  statTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },

  // Softer colors with a bit of transparency
  confirmedCard: {
    backgroundColor: 'rgba(39, 174, 96, 0.9)', // green
  },
  pendingCard: {
    backgroundColor: 'rgba(242, 201, 76, 0.9)', // amber
  },
  rejectedCard: {
    backgroundColor: 'rgba(235, 87, 87, 0.9)', // red
  },
  totalCard: {
    backgroundColor: 'rgba(45, 156, 219, 0.9)', // blue
  },

  /* BOTTOM SECTION – same idea as before */
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020B4F',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: NSB_COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  actionTextWrapper: {
    flex: 1,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionSubtitle: {
    color: '#B0B0B0',
    fontSize: 11,
    marginTop: 2,
  },
  footer: {
    marginTop: 28,
    alignItems: 'center',
  },
  footerText: {
    color: '#9EA5FF',
    fontSize: 11,
  },
});
