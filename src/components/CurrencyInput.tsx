import React, { useState, useEffect } from 'react';
import { TextInput, TextInputProps } from 'react-native';

interface CurrencyInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string | number;
  onChangeValue: (value: string) => void;
}

export function CurrencyInput({ value, onChangeValue, style, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    const strVal = String(value).replace(/[^0-9]/g, '');
    if (strVal) {
      setDisplayValue(Number(strVal).toLocaleString());
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (text: string) => {
    const numericStr = text.replace(/[^0-9]/g, '');
    if (numericStr) {
      setDisplayValue(Number(numericStr).toLocaleString());
      onChangeValue(numericStr);
    } else {
      setDisplayValue('');
      onChangeValue('');
    }
  };

  return (
    <TextInput
      style={style}
      value={displayValue}
      onChangeText={handleChange}
      keyboardType="number-pad"
      {...props}
    />
  );
}
