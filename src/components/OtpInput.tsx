import { useEffect, useRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  autoFocus,
  cellColors,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  cellColors: {
    background: string;
    border: string;
    borderActive: string;
    text: string;
    placeholder: string;
  };
}) {
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (autoFocus) {
      inputs.current[0]?.focus();
    }
  }, [autoFocus]);

  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  function focusIndex(index: number) {
    const clamped = Math.max(0, Math.min(length - 1, index));
    inputs.current[clamped]?.focus();
  }

  function handleChange(index: number, raw: string) {
    const sanitized = raw.replace(/\D/g, '');
    if (sanitized.length > 1) {
      const chunk = sanitized.slice(0, length);
      onChange(chunk);
      focusIndex(Math.min(chunk.length, length - 1));
      return;
    }
    const next = digits.slice();
    next[index] = sanitized.slice(-1);
    onChange(next.join(''));
    if (sanitized && index < length - 1) {
      focusIndex(index + 1);
    }
  }

  function handleKeyPress(
    index: number,
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) {
    if (event.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      const next = digits.slice();
      next[index - 1] = '';
      onChange(next.join(''));
      focusIndex(index - 1);
    }
  }

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          editable={!disabled}
          keyboardType="number-pad"
          maxLength={1}
          onChangeText={(raw) => handleChange(index, raw)}
          onKeyPress={(event) => handleKeyPress(index, event)}
          placeholder=""
          placeholderTextColor={cellColors.placeholder}
          textContentType={index === 0 ? 'oneTimeCode' : 'none'}
          value={digit}
          style={[
            styles.cell,
            {
              backgroundColor: cellColors.background,
              borderColor: digit ? cellColors.borderActive : cellColors.border,
              color: cellColors.text,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 8,
  },
  cell: {
    width: 44,
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
});
