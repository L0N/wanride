import React, { useState } from 'react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const DateRangePicker = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState(value);

  // Quick preset options
  const presets = [
    {
      label: 'Today',
      getValue: () => ({
        from: startOfDay(new Date()),
        to: endOfDay(new Date())
      })
    },
    {
      label: 'Yesterday',
      getValue: () => ({
        from: startOfDay(subDays(new Date(), 1)),
        to: endOfDay(subDays(new Date(), 1))
      })
    },
    {
      label: 'Last 7 days',
      getValue: () => ({
        from: startOfDay(subDays(new Date(), 7)),
        to: endOfDay(new Date())
      })
    },
    {
      label: 'This week',
      getValue: () => ({
        from: startOfWeek(new Date()),
        to: endOfWeek(new Date())
      })
    },
    {
      label: 'Last 30 days',
      getValue: () => ({
        from: startOfDay(subDays(new Date(), 30)),
        to: endOfDay(new Date())
      })
    },
    {
      label: 'This month',
      getValue: () => ({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
      })
    }
  ];

  // Handle preset selection
  const handlePresetSelect = (preset) => {
    const newRange = preset.getValue();
    setTempRange(newRange);
    onChange(newRange);
    setIsOpen(false);
  };

  // Handle manual date input
  const handleDateChange = (field, dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return;

    const newRange = {
      ...tempRange,
      [field]: field === 'from' ? startOfDay(date) : endOfDay(date)
    };

    setTempRange(newRange);
  };

  // Apply manual date range
  const handleApply = () => {
    if (tempRange.from && tempRange.to && tempRange.from <= tempRange.to) {
      onChange(tempRange);
      setIsOpen(false);
    }
  };

  // Cancel changes
  const handleCancel = () => {
    setTempRange(value);
    setIsOpen(false);
  };

  // Format display text
  const getDisplayText = () => {
    if (!value.from || !value.to) return 'Select date range';
    
    const fromStr = format(value.from, 'MMM dd');
    const toStr = format(value.to, 'MMM dd');
    
    if (format(value.from, 'yyyy-MM-dd') === format(value.to, 'yyyy-MM-dd')) {
      return format(value.from, 'MMM dd, yyyy');
    }
    
    if (format(value.from, 'yyyy') === format(value.to, 'yyyy')) {
      return `${fromStr} - ${toStr}, ${format(value.to, 'yyyy')}`;
    }
    
    return `${format(value.from, 'MMM dd, yyyy')} - ${format(value.to, 'MMM dd, yyyy')}`;
  };

  return (
    <div className="date-range-picker">
      <button 
        className="date-range-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="date-range-icon">📅</span>
        <span className="date-range-text">{getDisplayText()}</span>
        <span className="date-range-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="date-range-dropdown">
          <div className="date-range-content">
            {/* Quick Presets */}
            <div className="date-range-presets">
              <h4>Quick Select</h4>
              <div className="presets-list">
                {presets.map((preset, index) => (
                  <button
                    key={index}
                    className="preset-btn"
                    onClick={() => handlePresetSelect(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            <div className="date-range-custom">
              <h4>Custom Range</h4>
              <div className="custom-inputs">
                <div className="date-input-group">
                  <label>From:</label>
                  <input
                    type="date"
                    value={tempRange.from ? format(tempRange.from, 'yyyy-MM-dd') : ''}
                    onChange={(e) => handleDateChange('from', e.target.value)}
                    className="date-input"
                  />
                </div>
                <div className="date-input-group">
                  <label>To:</label>
                  <input
                    type="date"
                    value={tempRange.to ? format(tempRange.to, 'yyyy-MM-dd') : ''}
                    onChange={(e) => handleDateChange('to', e.target.value)}
                    className="date-input"
                  />
                </div>
              </div>
              
              <div className="custom-actions">
                <button 
                  className="btn-secondary"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary"
                  onClick={handleApply}
                  disabled={!tempRange.from || !tempRange.to || tempRange.from > tempRange.to}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
