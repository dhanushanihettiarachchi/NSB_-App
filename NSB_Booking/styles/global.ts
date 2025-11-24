// styles/global.ts
import { StyleSheet } from 'react-native';

export const NSB_COLORS = {
  blue: '#060340',
  blueCard: '#06052A',
  gold: '#FDB913',
  inputBg: '#FFEFD5',
  textWhite: '#FFFFFF',
  textMuted: '#CCCCCC',
  footer: '#CCCCCC',
};

export const globalStyles = StyleSheet.create({
  // main screen container (most screens)
  screenContainer: {
    flex: 1,
    backgroundColor: NSB_COLORS.blue,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },

  // centered layout (e.g. splash)
  centeredScreen: {
    flex: 1,
    backgroundColor: NSB_COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  backButton: {
    padding: 4,
  },

  headingMain: {
    color: NSB_COLORS.textWhite,
    fontSize: 22,
    fontWeight: '700',
  },

  headingSmall: {
    color: NSB_COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  formCard: {
    backgroundColor: NSB_COLORS.blueCard,
    borderRadius: 16,
    padding: 20,
  },

  label: {
    color: NSB_COLORS.textWhite,
    fontSize: 14,
    marginBottom: 6,
  },

  input: {
    backgroundColor: NSB_COLORS.inputBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333333',
  },

  primaryButton: {
    backgroundColor: NSB_COLORS.gold,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },

  primaryButtonText: {
    color: NSB_COLORS.blue,
    fontSize: 16,
    fontWeight: '700',
  },

  footer: {
    marginTop: 'auto',
    alignItems: 'center',
  },

  footerText: {
    color: NSB_COLORS.footer,
    fontSize: 11,
  },

  smallTextLight: {
    color: NSB_COLORS.textWhite,
    fontSize: 12,
    textAlign: 'center',
  },

  linkText: {
    color: NSB_COLORS.gold,
    fontWeight: '600',
  },
});
