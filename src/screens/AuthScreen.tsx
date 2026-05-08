import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OtpInput } from '../components/OtpInput';
import { SonikLogo } from '../components/SonikLogo';
import { TrackArt } from '../components/TrackArt';
import { useAppContext } from '../context/AppContext';

export function AuthScreen() {
  const {
    theme,
    themeMode,
    styles,
    view,
    setView,
    loginForm,
    setLoginForm,
    registerForm,
    setRegisterForm,
    resetForm,
    setResetForm,
    otpForm,
    setOtpForm,
    otpStep,
    setOtpStep,
    emailStatus,
    isSubmitting,
    errorMessage,
    noticeMessage,
    clearFeedback,
    googleEnabled,
    googleRequest,
    selectedTrack,
    toggleThemeMode,
    handleLogin,
    handleSendOtp,
    handleVerifyOtpForSignup,
    handleVerifyOtpForPasswordReset,
    openGoogleFlow,
  } = useAppContext();

  const authTitle =
    view === 'login'
      ? 'Sign in to Sonik'
      : view === 'register-otp'
        ? 'Create your account'
        : 'Reset your password';

  const authCopy =
    view === 'login'
      ? 'Your library, playlists, and playback stay in sync.'
      : view === 'register-otp'
        ? 'Verify your email with a one-time code, then choose a password.'
        : 'We will send a code to your email if the account exists.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.accessContent} showsVerticalScrollIndicator={false}>
        <View style={styles.appHeader}>
          <View style={styles.brandRow}>
            <SonikLogo size={28} />
            <Text style={styles.brandName}>Sonik</Text>
          </View>
          <Pressable
            accessibilityLabel={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            style={styles.themeButton}
            onPress={toggleThemeMode}
          >
            <Ionicons color={theme.text} name={themeMode === 'dark' ? 'sunny' : 'moon'} size={18} />
            <Text style={styles.themeButtonLabel}>{themeMode === 'dark' ? 'Light' : 'Dark'}</Text>
          </Pressable>
        </View>

        <View style={styles.previewDeck}>
          <TrackArt track={selectedTrack} size="large" />
          <Text style={styles.previewTitle}>Music that keeps moving with you.</Text>
          <Text style={styles.previewCopy}>
            Browse, collect, and play your favorite tracks from one account.
          </Text>
        </View>

        <View style={styles.authCard}>
          <View style={styles.tabRow}>
            {(['login', 'register-otp'] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => {
                  clearFeedback();
                  if (value === 'register-otp') {
                    setRegisterForm({ profileName: '', email: '', password: '', confirmPassword: '' });
                    setOtpForm({ email: '', otp: '' });
                    setOtpStep('email');
                  }
                  setView(value);
                }}
                style={[styles.tabButton, view === value ? styles.tabButtonActive : null]}
              >
                <Text style={[styles.tabLabel, view === value ? styles.tabLabelActive : null]}>
                  {value === 'login' ? 'Sign in' : 'Create'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.cardTitle}>{authTitle}</Text>
          <Text style={styles.caption}>{authCopy}</Text>

          {errorMessage ? (
            <View style={[styles.feedback, styles.feedbackError]}>
              <Text style={styles.feedbackText}>{errorMessage}</Text>
            </View>
          ) : null}
          {noticeMessage ? (
            <View style={[styles.feedback, styles.feedbackNotice]}>
              <Text style={styles.feedbackText}>{noticeMessage}</Text>
            </View>
          ) : null}

          {view === 'login' ? (
            <>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={(email) => setLoginForm((c) => ({ ...c, email }))}
                placeholder="listener@sonik.app"
                placeholderTextColor={theme.muted}
                style={styles.input}
                value={loginForm.email}
              />
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={(password) => setLoginForm((c) => ({ ...c, password }))}
                placeholder="Password"
                placeholderTextColor={theme.muted}
                secureTextEntry
                style={styles.input}
                value={loginForm.password}
              />
              <Pressable disabled={isSubmitting} onPress={handleLogin} style={styles.primaryButton}>
                <Text style={styles.primaryButtonLabel}>{isSubmitting ? 'Signing in' : 'Sign in'}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  clearFeedback();
                  setOtpForm({ email: loginForm.email, otp: '' });
                  setOtpStep('email');
                  setResetForm({ newPassword: '' });
                  setView('forgot-otp');
                }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>Forgot password?</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  clearFeedback();
                  setRegisterForm({ profileName: '', email: '', password: '', confirmPassword: '' });
                  setOtpForm({ email: '', otp: '' });
                  setOtpStep('email');
                  setView('register-otp');
                }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>Don&apos;t have an account? Create one</Text>
              </Pressable>
            </>
          ) : null}

          {view === 'register-otp' ? (
            <>
              <Text style={styles.otpTitle}>Create Your Account</Text>
              {otpStep === 'email' ? (
                <>
                  <TextInput
                    onChangeText={(profileName) => setRegisterForm((c) => ({ ...c, profileName }))}
                    placeholder="Profile name"
                    placeholderTextColor={theme.muted}
                    style={styles.input}
                    value={registerForm.profileName}
                  />
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onChangeText={(email) => setOtpForm((c) => ({ ...c, email }))}
                    placeholder="Email address"
                    placeholderTextColor={theme.muted}
                    style={styles.input}
                    value={otpForm.email}
                  />
                  {emailStatus === 'checking' && (
                    <Text style={{ color: theme.muted, marginTop: 4, fontSize: 13, alignSelf: 'flex-start', paddingLeft: 16 }}>
                      Checking availability…
                    </Text>
                  )}
                  {emailStatus === 'taken' && (
                    <Text style={{ color: theme.danger, marginTop: 4, fontSize: 13, alignSelf: 'flex-start', paddingLeft: 16 }}>
                      This email is already registered. Please sign in instead.
                    </Text>
                  )}
                  {emailStatus === 'available' && (
                    <Text style={{ color: theme.secondary, marginTop: 4, fontSize: 13, alignSelf: 'flex-start', paddingLeft: 16 }}>
                      ✓ Email is available
                    </Text>
                  )}
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={(password) => setRegisterForm((c) => ({ ...c, password }))}
                    placeholder="Create password"
                    placeholderTextColor={theme.muted}
                    secureTextEntry
                    style={styles.input}
                    value={registerForm.password}
                  />
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={(confirmPassword) => setRegisterForm((c) => ({ ...c, confirmPassword }))}
                    placeholder="Confirm password"
                    placeholderTextColor={theme.muted}
                    secureTextEntry
                    style={styles.input}
                    value={registerForm.confirmPassword}
                  />
                  <Pressable
                    disabled={
                      isSubmitting ||
                      !registerForm.profileName ||
                      !otpForm.email ||
                      !registerForm.password ||
                      !registerForm.confirmPassword ||
                      registerForm.password !== registerForm.confirmPassword ||
                      emailStatus === 'checking' ||
                      emailStatus === 'taken'
                    }
                    onPress={() => void handleSendOtp('signup')}
                    style={[
                      styles.primaryButton,
                      (isSubmitting ||
                        !registerForm.profileName ||
                        !otpForm.email ||
                        !registerForm.password ||
                        !registerForm.confirmPassword ||
                        registerForm.password !== registerForm.confirmPassword ||
                        emailStatus === 'checking' ||
                        emailStatus === 'taken') &&
                        styles.disabledButton,
                    ]}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isSubmitting ? 'Sending code' : 'Send verification code'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.otpSubtitle}>
                    Enter the verification code sent to {otpForm.email}
                  </Text>
                  <OtpInput
                    autoFocus
                    disabled={isSubmitting}
                    onChange={(otp) => setOtpForm((c) => ({ ...c, otp }))}
                    value={otpForm.otp}
                    cellColors={{
                      background: theme.field,
                      border: theme.border,
                      borderActive: theme.text,
                      text: theme.text,
                      placeholder: theme.muted,
                    }}
                  />
                  <Pressable
                    disabled={isSubmitting || otpForm.otp.length !== 6}
                    onPress={handleVerifyOtpForSignup}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isSubmitting ? 'Creating account' : 'Verify & create'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={isSubmitting}
                    onPress={() => void handleSendOtp('signup')}
                    style={styles.textButton}
                  >
                    <Text style={styles.textButtonLabel}>Resend code</Text>
                  </Pressable>
                </>
              )}
              <Pressable
                onPress={() => { clearFeedback(); setView('login'); }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>Back to sign in</Text>
              </Pressable>
            </>
          ) : null}

          {view === 'forgot-otp' ? (
            <>
              <Text style={styles.otpTitle}>Reset Password</Text>
              {otpStep === 'email' ? (
                <>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={otpForm.email}
                    placeholder="Email address"
                    placeholderTextColor={theme.muted}
                    style={styles.input}
                    editable={false}
                  />
                  <Pressable
                    disabled={isSubmitting}
                    onPress={() => void handleSendOtp('reset')}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isSubmitting ? 'Sending code' : 'Send reset code'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.otpSubtitle}>
                    Enter the verification code sent to {otpForm.email}
                  </Text>
                  <OtpInput
                    autoFocus
                    disabled={isSubmitting}
                    onChange={(otp) => setOtpForm((c) => ({ ...c, otp }))}
                    value={otpForm.otp}
                    cellColors={{
                      background: theme.field,
                      border: theme.border,
                      borderActive: theme.text,
                      text: theme.text,
                      placeholder: theme.muted,
                    }}
                  />
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={(newPassword) => setResetForm((c) => ({ ...c, newPassword }))}
                    placeholder="New password"
                    placeholderTextColor={theme.muted}
                    secureTextEntry
                    style={styles.input}
                    value={resetForm.newPassword}
                  />
                  <Pressable
                    disabled={isSubmitting || otpForm.otp.length !== 6 || !resetForm.newPassword}
                    onPress={handleVerifyOtpForPasswordReset}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isSubmitting ? 'Updating password' : 'Verify & reset'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={isSubmitting}
                    onPress={() => void handleSendOtp('reset')}
                    style={styles.textButton}
                  >
                    <Text style={styles.textButtonLabel}>Resend code</Text>
                  </Pressable>
                </>
              )}
              <Pressable
                onPress={() => { clearFeedback(); setView('login'); }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>Back to sign in</Text>
              </Pressable>
            </>
          ) : null}

          {view === 'login' && googleEnabled ? (
            <Pressable
              disabled={isSubmitting || !googleRequest}
              onPress={openGoogleFlow}
              style={styles.googleButton}
            >
              <Ionicons color={theme.text} name="logo-google" size={18} />
              <Text style={styles.googleButtonLabel}>Continue with Google</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
