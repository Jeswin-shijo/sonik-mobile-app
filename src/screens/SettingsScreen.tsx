import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { languageOptions } from '../constants/languages';
import { useAppContext } from '../context/AppContext';
import { resolveAvatarUrl } from '../utils/music';

export function SettingsScreen() {
  const {
    theme,
    themeMode,
    styles,
    session,
    isSubmitting,
    errorMessage,
    noticeMessage,
    clearFeedback,
    isDeleteAccountConfirming,
    setIsDeleteAccountConfirming,
    profileForm,
    setProfileForm,
    passwordForm,
    setPasswordForm,
    setIsSettingsOpen,
    handleUpdateProfile,
    handleChangePassword,
    handleDeleteAccount,
    handleUploadAvatar,
    t,
  } = useAppContext();

  if (!session) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />

      <View style={styles.settingsHeader}>
        <Pressable
          onPress={() => { setIsSettingsOpen(false); clearFeedback(); }}
          style={styles.settingsBackButton}
        >
          <Ionicons color={theme.text} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.settingsTitle}>{t('settings')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.settingsContent} showsVerticalScrollIndicator={false}>
        {errorMessage ? (
          <View style={[styles.feedback, styles.feedbackError, { marginHorizontal: 16, marginBottom: 16 }]}>
            <Text style={styles.feedbackText}>{errorMessage}</Text>
          </View>
        ) : null}
        {noticeMessage ? (
          <View style={[styles.feedback, styles.feedbackNotice, { marginHorizontal: 16, marginBottom: 16 }]}>
            <Text style={styles.feedbackText}>{noticeMessage}</Text>
          </View>
        ) : null}

        {/* Profile Header Card */}
        <Pressable
          onPress={() => void handleUploadAvatar()}
          style={({ pressed }) => [styles.modernSettingsProfileCard, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.modernAvatarContainer}>
            {resolveAvatarUrl(session.user.avatarUrl) ? (
              <Image source={{ uri: resolveAvatarUrl(session.user.avatarUrl)! }} style={styles.modernAvatar} />
            ) : (
              <View style={[styles.modernAvatar, styles.spotifyAvatarPlaceholder]}>
                <Text style={styles.modernAvatarInitial}>
                  {session.user.profileName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </View>
          <View style={styles.modernProfileMeta}>
            <Text style={styles.modernProfileName} numberOfLines={1}>
              {session.user.profileName}
            </Text>
            <Text style={styles.modernProfileSubtitle} numberOfLines={1}>
              {session.user.email}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.muted} style={{ marginLeft: 'auto' }} />
        </Pressable>

        {/* General section */}
        <View style={styles.spotifySettingsSection}>
          <Text style={styles.spotifySettingsSectionTitle}>{t('general')}</Text>

          <Text style={styles.fieldLabel}>{t('displayName')}</Text>
          <TextInput
            onChangeText={(text) => setProfileForm({ ...profileForm, profileName: text })}
            style={styles.spotifyInput}
            value={profileForm.profileName}
          />

          <Text style={styles.fieldLabel}>{t('birthday')}</Text>
          <TextInput
            onChangeText={(text) => setProfileForm({ ...profileForm, birthday: text })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.muted}
            style={styles.spotifyInput}
            value={profileForm.birthday}
          />

          <Text style={styles.fieldLabel}>{t('language')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.languageScroller}
          >
            {languageOptions.map((lang) => (
              <Pressable
                key={lang.code}
                onPress={() => setProfileForm({ ...profileForm, language: lang.code })}
                style={[
                  styles.languageChip,
                  profileForm.language === lang.code ? styles.languageChipActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.languageChipText,
                    profileForm.language === lang.code ? styles.languageChipTextActive : null,
                  ]}
                >
                  {lang.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            disabled={isSubmitting}
            onPress={() => void handleUpdateProfile()}
            style={styles.settingsPrimaryAction}
          >
            <Text style={styles.settingsPrimaryActionText}>
              {isSubmitting ? 'Saving…' : t('saveProfile')}
            </Text>
          </Pressable>
        </View>

        {/* Security section */}
        <View style={styles.spotifySettingsSection}>
          <Text style={styles.spotifySettingsSectionTitle}>{t('security')}</Text>

          <Text style={styles.fieldLabel}>Current Password</Text>
          <TextInput
            onChangeText={(text) => setPasswordForm({ ...passwordForm, currentPassword: text })}
            placeholderTextColor={theme.muted}
            secureTextEntry
            style={styles.spotifyInput}
            value={passwordForm.currentPassword}
          />

          <Text style={styles.fieldLabel}>New Password</Text>
          <TextInput
            onChangeText={(text) => setPasswordForm({ ...passwordForm, newPassword: text })}
            placeholderTextColor={theme.muted}
            secureTextEntry
            style={styles.spotifyInput}
            value={passwordForm.newPassword}
          />

          <Pressable
            disabled={isSubmitting || !passwordForm.currentPassword || !passwordForm.newPassword}
            onPress={() => void handleChangePassword()}
            style={[
              styles.settingsSecondaryAction,
              (isSubmitting || !passwordForm.currentPassword || !passwordForm.newPassword) &&
                styles.disabledButton,
            ]}
          >
            <Text style={styles.settingsSecondaryActionText}>
              {isSubmitting ? 'Saving…' : t('changePassword')}
            </Text>
          </Pressable>
        </View>

        {/* Account removal */}
        <View style={styles.accountRemovalSection}>
          <View style={styles.accountRemovalCopy}>
            <Text style={styles.accountRemovalTitle}>{t('deleteAccount')}</Text>
            <Text style={styles.accountRemovalDescription}>
              Permanently remove your account and saved listening data.
            </Text>
          </View>
          <Pressable
            disabled={isSubmitting}
            onPress={() => void handleDeleteAccount()}
            style={styles.deleteAccountAction}
          >
            <Text style={styles.deleteAccountActionText}>
              {isSubmitting ? 'Deleting…' : isDeleteAccountConfirming ? 'Are you sure?' : t('deleteAccount')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Delete account confirmation dialog */}
      <Modal
        animationType="fade"
        onRequestClose={() => setIsDeleteAccountConfirming(false)}
        transparent
        visible={isDeleteAccountConfirming}
      >
        <Pressable
          onPress={() => setIsDeleteAccountConfirming(false)}
          style={styles.confirmationBackdrop}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.confirmationDialog}>
            <View style={styles.confirmationHeader}>
              <Ionicons color={theme.danger} name="warning" size={32} />
              <Text style={styles.confirmationTitle}>Delete Account?</Text>
            </View>
            <Text style={styles.confirmationMessage}>
              This will permanently delete your account and all associated data including playlists,
              liked songs, and listening history. This action cannot be undone.
            </Text>
            <View style={styles.confirmationActions}>
              <Pressable
                onPress={() => setIsDeleteAccountConfirming(false)}
                style={[styles.confirmationButton, styles.confirmationCancelButton]}
              >
                <Text style={styles.confirmationCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={isSubmitting}
                onPress={handleDeleteAccount}
                style={[styles.confirmationButton, styles.confirmationDeleteButton]}
              >
                <Text style={styles.confirmationDeleteText}>
                  {isSubmitting ? 'Deleting...' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
