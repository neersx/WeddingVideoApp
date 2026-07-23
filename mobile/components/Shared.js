import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { MONTHS, WEEKDAYS, palette, styles } from '../lib/shared';

export function DatePickerModal({ visible, value, onClose, onSelect }) {
  const parsed = useMemo(() => {
    if (!value) return { date: new Date(), valid: false };
    // Stored as "14 December 2026" — rearrange to "December 14 2026" for reliable parsing.
    const match = value.match(/^(\d{1,2}) (\w+) (\d{4})$/);
    const date = match ? new Date(`${match[2]} ${match[1]}, ${match[3]}`) : new Date(value);
    return Number.isNaN(date.getTime()) ? { date: new Date(), valid: false } : { date, valid: true };
  }, [value]);
  const [viewYear, setViewYear] = useState(parsed.date.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.date.getMonth());
  useEffect(() => { if (visible) { setViewYear(parsed.date.getFullYear()); setViewMonth(parsed.date.getMonth()); } }, [visible, parsed]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const today = new Date();
  const isToday = (day) => day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isSelected = (day) => parsed.valid && day === parsed.date.getDate() && viewMonth === parsed.date.getMonth() && viewYear === parsed.date.getFullYear();

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.calendarCard} onPress={() => {}}>
          <View style={styles.calendarHeader}>
            <Pressable onPress={() => shiftMonth(-1)} style={styles.calendarArrow} hitSlop={8}><Text style={styles.calendarArrowText}>‹</Text></Pressable>
            <Text style={styles.calendarMonth}>{MONTHS[viewMonth]} {viewYear}</Text>
            <Pressable onPress={() => shiftMonth(1)} style={styles.calendarArrow} hitSlop={8}><Text style={styles.calendarArrowText}>›</Text></Pressable>
          </View>
          <View style={styles.calendarWeekRow}>
            {WEEKDAYS.map((day, i) => <Text key={`${day}-${i}`} style={styles.calendarWeekday}>{day}</Text>)}
          </View>
          <View style={styles.calendarGrid}>
            {cells.map((day, index) => (
              <View key={index} style={styles.calendarCell}>
                {day ? (
                  <Pressable
                    onPress={() => onSelect(`${day} ${MONTHS[viewMonth]} ${viewYear}`)}
                    style={[styles.calendarDay, isToday(day) && styles.calendarToday, isSelected(day) && styles.calendarSelected]}
                  >
                    <Text style={[styles.calendarDayText, isSelected(day) && styles.calendarSelectedText]}>{day}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
          <Pressable onPress={onClose} style={styles.calendarClose}><Text style={styles.calendarCloseText}>Cancel</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function Field({ label, style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, props.multiline && styles.multiline, focused && styles.inputFocused]}
        placeholderTextColor={palette.textMuted}
        selectionColor={palette.gold}
      />
    </View>
  );
}

// Renders a category's form schema. Each field type maps to a control; fields
// carrying a `capability` only appear when the selected template supports it.
export function DynamicForm({ schema, template, relationships, values, onChange, onOpenDatePicker }) {
  const fieldList = (schema && schema.fields) || [];
  const supports = (capability) => !capability || Boolean(template?.capabilities?.[capability]?.supported);
  return (
    <>
      {fieldList.filter((f) => supports(f.capability)).map((f) => {
        const value = values[f.key] || '';
        if (f.type === 'select') {
          const options = f.optionsRef === 'relationships' ? relationships : (f.options || []);
          return (
            <View key={f.key} style={styles.field}>
              <Text style={styles.label}>{f.label}{f.required ? ' *' : ''}</Text>
              <View style={styles.optionWrap}>
                {options.map((opt) => {
                  const selected = value === opt.value;
                  return (
                    <Pressable key={opt.value} onPress={() => onChange(f.key, opt.value)} style={[styles.optionChip, selected && styles.optionChipActive]}>
                      <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        }
        if (f.type === 'date') {
          return (
            <View key={f.key} style={styles.field}>
              <Text style={styles.label}>{f.label}{f.required ? ' *' : ''}</Text>
              <Pressable onPress={() => onOpenDatePicker(f.key)} style={styles.input}>
                <View style={styles.dateRow}>
                  <Text style={value ? styles.dateValue : styles.datePlaceholder}>{value || 'Select a date'}</Text>
                  <Text style={styles.dateIcon}>📅</Text>
                </View>
              </Pressable>
            </View>
          );
        }
        if (f.type === 'repeater') {
          const rows = Array.isArray(value) ? value : [];
          const itemFields = f.itemFields || [{ key: 'name' }, { key: 'time' }];
          const max = f.max || 6;
          const updateRow = (rowIndex, itemKey, itemValue) => onChange(f.key, rows.map((row, i) => (i === rowIndex ? { ...row, [itemKey]: itemValue } : row)));
          const removeRow = (rowIndex) => onChange(f.key, rows.filter((_, i) => i !== rowIndex));
          const addRow = () => { if (rows.length < max) onChange(f.key, [...rows, {}]); };
          return (
            <View key={f.key} style={styles.scheduleSection}>
              <View style={styles.scheduleHeader}>
                <Text style={styles.scheduleTitle}>{f.label}</Text>
                <Pressable onPress={addRow} disabled={rows.length >= max} style={[styles.addEventButton, rows.length >= max && styles.buttonDisabled]}>
                  <Text style={styles.addEventText}>＋ Add</Text>
                </Pressable>
              </View>
              {rows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.scheduleRow}>
                  {itemFields.map((item, itemIndex) => (
                    <TextInput
                      key={item.key}
                      value={row[item.key] || ''}
                      onChangeText={(v) => updateRow(rowIndex, item.key, v)}
                      placeholder={item.placeholder || ''}
                      placeholderTextColor={palette.textMuted}
                      selectionColor={palette.gold}
                      style={[styles.input, itemIndex === 0 ? styles.scheduleName : styles.scheduleTime]}
                    />
                  ))}
                  <Pressable onPress={() => removeRow(rowIndex)} style={styles.scheduleRemove} hitSlop={8}>
                    <Text style={styles.scheduleRemoveText}>✕</Text>
                  </Pressable>
                </View>
              ))}
              {rows.length === 0 && <Text style={styles.helper}>No items yet — tap “Add”.</Text>}
            </View>
          );
        }
        // text / textarea
        return (
          <Field
            key={f.key}
            label={`${f.label}${f.required ? ' *' : ''}`}
            value={value}
            onChangeText={(v) => onChange(f.key, v)}
            placeholder={f.placeholder || ''}
            multiline={f.type === 'textarea'}
            maxLength={f.maxLength}
          />
        );
      })}
    </>
  );
}

export function RenderedVideo({ uri, style }) {
  const player = useVideoPlayer({ uri, contentType: 'progressive' }, (instance) => { instance.loop = false; });
  const playback = useEvent(player, 'statusChange', { status: player.status, error: null });
  useEffect(() => { if (playback.status === 'readyToPlay') player.play(); }, [playback.status, player]);
  return (
    <View>
      <VideoView player={player} style={[styles.video, style]} nativeControls contentFit="contain" />
      {playback.status === 'loading' ? (
        <View style={styles.videoLoading}>
          <ActivityIndicator color={palette.gold} />
          <Text style={styles.videoLoadingText}>Loading video…</Text>
        </View>
      ) : null}
      {playback.status === 'error' ? <Text style={styles.videoError}>Video could not be loaded: {playback.error?.message || 'unknown playback error'}</Text> : null}
    </View>
  );
}
