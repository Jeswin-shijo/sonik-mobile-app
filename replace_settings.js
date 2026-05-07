const fs = require('fs');
const file = 'App.tsx';
let content = fs.readFileSync(file, 'utf8');

const startStr = "  if (session && isSettingsOpen) {";
const endStr = "  if (session) {\n    return (\n      <SafeAreaView style={styles.safeArea}>";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const newSettingsView = `  if (session && isSettingsOpen) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <View style={styles.settingsHeader}>
          <Pressable
            onPress={() => {
              setIsSettingsOpen(false);
              clearFeedback();
            }}
            style={styles.settingsBackButton}
          >
            <Ionicons color={theme.text} name="chevron-back" size={24} />
          </Pressable>
          <Text style={styles.settingsTitle}>{t('settings')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
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

          <View style={styles.spotifySettingsSection}>
            <Text style={styles.spotifySettingsSectionTitle}>{t('avatar')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              {session.user.avatarUrl ? (
                <Image
                  source={{ uri: session.user.avatarUrl }}
                  style={{ width: 64, height: 64, borderRadius: 32 }}
                />
              ) : (
                <View style={[{ width: 64, height: 64, borderRadius: 32 }, styles.spotifyAvatarPlaceholder]}>
                  <Text style={[styles.spotifyAvatarInitial, { fontSize: 28 }]}>
                    {session.user.profileName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => {
                  void handleUploadAvatar();
                }}
                style={styles.spotifyCreateButton}
              >
                <Text style={styles.spotifyCreateButtonText}>
                  {session.user.avatarUrl ? 'Change Avatar' : 'Upload Avatar'}
                </Text>
              </Pressable>
            </View>
          </View>

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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingBottom: 15, paddingTop: 4 }}>
              {[
                { code: 'en', label: 'English' },
                { code: 'ta', label: 'தமிழ்' },
                { code: 'hi', label: 'हिन्दी' },
                { code: 'te', label: 'తెలుగు' },
                { code: 'ml', label: 'മലയാളം' },
                { code: 'kn', label: 'ಕನ್ನಡ' },
              ].map((lang) => (
                <Pressable
                  key={lang.code}
                  onPress={() => setProfileForm({ ...profileForm, language: lang.code })}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: profileForm.language === lang.code ? theme.accent : theme.surfaceSoft,
                  }}
                >
                  <Text style={{ color: profileForm.language === lang.code ? theme.accentText : theme.text, fontSize: 14, fontWeight: '700' }}>
                    {lang.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              disabled={isSubmitting}
              onPress={() => {
                void handleUpdateProfile();
              }}
              style={[styles.spotifyCreateButton, { alignSelf: 'flex-start', marginTop: 8 }]}
            >
              <Text style={styles.spotifyCreateButtonText}>
                {isSubmitting ? 'Saving…' : t('saveProfile')}
              </Text>
            </Pressable>
          </View>

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
              onPress={() => {
                void handleChangePassword();
              }}
              style={[styles.spotifyCreateButton, { alignSelf: 'flex-start', marginTop: 8, opacity: (isSubmitting || !passwordForm.currentPassword || !passwordForm.newPassword) ? 0.5 : 1 }]}
            >
              <Text style={styles.spotifyCreateButtonText}>
                {isSubmitting ? 'Saving…' : t('changePassword')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.spotifySettingsSection}>
            <Text style={styles.spotifySettingsSectionTitle}>{t('dangerZone')}</Text>
            <Pressable
              disabled={isSubmitting}
              onPress={() => {
                void handleDeleteAccount();
              }}
              style={[styles.spotifyCreateButton, { backgroundColor: theme.danger, alignSelf: 'flex-start' }]}
            >
              <Text style={[styles.spotifyCreateButtonText, { color: '#fff' }]}>
                {isSubmitting ? 'Deleting…' : isDeleteAccountConfirming ? 'Are you sure?' : t('deleteAccount')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

`;
  content = content.substring(0, startIndex) + newSettingsView + content.substring(endIndex);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully replaced settings view.');
} else {
  console.log('Could not find start or end string.');
  console.log('StartIndex:', startIndex, 'EndIndex:', endIndex);
}
