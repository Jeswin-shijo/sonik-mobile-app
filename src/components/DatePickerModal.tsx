import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const ITEM_H = 44;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2);

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

interface ColumnProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  textColor: string;
  mutedColor: string;
  accentColor: string;
}

function Column({ items, selectedIndex, onSelect, textColor, mutedColor, accentColor }: ColumnProps) {
  const scrollRef = useRef<ScrollView>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
  }, [selectedIndex]);

  return (
    <View style={colStyles.wrap}>
      <View pointerEvents="none" style={[colStyles.highlight, { borderColor: accentColor }]} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: PAD * ITEM_H }}
        onScrollBeginDrag={() => { isDragging.current = true; }}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          const clamped = Math.max(0, Math.min(items.length - 1, idx));
          onSelect(clamped);
          isDragging.current = false;
        }}
        onScrollEndDrag={(e) => {
          if (!isDragging.current) return;
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          const clamped = Math.max(0, Math.min(items.length - 1, idx));
          onSelect(clamped);
          isDragging.current = false;
        }}
      >
        {items.map((label, i) => (
          <Pressable
            key={label}
            onPress={() => {
              onSelect(i);
              scrollRef.current?.scrollTo({ y: i * ITEM_H, animated: true });
            }}
            style={colStyles.item}
          >
            <Text
              style={[
                colStyles.label,
                { color: i === selectedIndex ? textColor : mutedColor },
                i === selectedIndex && colStyles.labelSelected,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

interface DatePickerModalProps {
  visible: boolean;
  value: string;
  onConfirm: (isoDate: string) => void;
  onDismiss: () => void;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  backgroundColor: string;
  borderColor: string;
}

export function DatePickerModal({
  visible,
  value,
  onConfirm,
  onDismiss,
  accentColor,
  textColor,
  mutedColor,
  backgroundColor,
  borderColor,
}: DatePickerModalProps) {
  const parsed = value ? new Date(value) : new Date(2000, 0, 1);
  const [month, setMonth] = useState(parsed.getMonth());
  const [day, setDay] = useState(parsed.getDate() - 1);
  const [year, setYear] = useState(parsed.getFullYear());

  const currentYear = new Date().getFullYear();
  const years = range(1900, currentYear).reverse();
  const days = range(1, daysInMonth(month, year)).map(String);

  // Clamp day when month/year changes
  useEffect(() => {
    const maxDay = daysInMonth(month, year) - 1;
    if (day > maxDay) setDay(maxDay);
  }, [month, year, day]);

  // Re-sync when value prop changes (e.g. on open)
  useEffect(() => {
    if (visible) {
      const d = value ? new Date(value) : new Date(2000, 0, 1);
      setMonth(d.getMonth());
      setDay(d.getDate() - 1);
      setYear(d.getFullYear());
    }
  }, [visible, value]);

  function confirm() {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day + 1).padStart(2, '0');
    onConfirm(`${year}-${mm}-${dd}`);
  }

  const yearIndex = years.indexOf(year);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable onPress={(e) => e.stopPropagation()} style={[styles.sheet, { backgroundColor }]}>
          <View style={[styles.handle, { backgroundColor: borderColor }]} />

          <View style={styles.header}>
            <Pressable onPress={onDismiss} style={styles.headerBtn}>
              <Text style={[styles.headerAction, { color: mutedColor }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.title, { color: textColor }]}>Select Date</Text>
            <Pressable onPress={confirm} style={styles.headerBtn}>
              <Text style={[styles.headerAction, { color: accentColor, fontWeight: '700' }]}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.pickerRow}>
            <Column
              items={MONTHS}
              selectedIndex={month}
              onSelect={setMonth}
              textColor={textColor}
              mutedColor={mutedColor}
              accentColor={accentColor}
            />
            <Column
              items={days}
              selectedIndex={day}
              onSelect={setDay}
              textColor={textColor}
              mutedColor={mutedColor}
              accentColor={accentColor}
            />
            <Column
              items={years.map(String)}
              selectedIndex={yearIndex >= 0 ? yearIndex : 0}
              onSelect={(i) => setYear(years[i]!)}
              textColor={textColor}
              mutedColor={mutedColor}
              accentColor={accentColor}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const colStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    height: ITEM_H * VISIBLE,
    overflow: 'hidden',
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: PAD * ITEM_H,
    left: 0,
    right: 0,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    zIndex: 1,
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
  },
  labelSelected: {
    fontWeight: '700',
    fontSize: 17,
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerBtn: {
    minWidth: 60,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerAction: {
    fontSize: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
});
