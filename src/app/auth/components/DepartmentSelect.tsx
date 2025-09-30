'use client';

import { useState, useRef, useEffect } from 'react';

interface Department {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
}

interface DepartmentSelectProps {
  departments: Department[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function DepartmentSelect({
  departments,
  value,
  onChange,
}: DepartmentSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedDept = departments.find(d => d.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getColorForLevel = (level: number) => {
    const colors = [
      '#1a202c', // Level 0 - darkest
      '#2d3748', // Level 1
      '#4a5568', // Level 2
      '#718096', // Level 3
      '#a0aec0', // Level 4+
    ];
    return colors[Math.min(level, colors.length - 1)];
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          fontSize: '1rem',
          textAlign: 'left',
          backgroundColor: '#ffffff',
          cursor: 'pointer',
          outline: 'none',
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = '#3182ce')}
        onBlur={e => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = '#e2e8f0';
          }
        }}
      >
        <span style={{ color: selectedDept ? '#1a202c' : '#a0aec0' }}>
          {selectedDept ? selectedDept.name : 'Select a department'}
        </span>
        <span style={{ fontSize: '0.75rem', color: '#718096' }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <input
              type='text'
              placeholder='Search departments...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3182ce')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
            />
          </div>

          <div>
            {filteredDepartments.map(dept => {
              const indent = dept.level * 16;
              const prefix = dept.level > 0 ? '└─ ' : '';

              return (
                <div
                  key={dept.id}
                  onClick={() => {
                    onChange(dept.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  style={{
                    padding: '0.75rem',
                    paddingLeft: `${0.75 + indent / 16}rem`,
                    cursor: 'pointer',
                    backgroundColor: value === dept.id ? '#ebf8ff' : '#ffffff',
                    transition: 'background-color 0.15s',
                    color: getColorForLevel(dept.level),
                    fontSize: dept.level === 0 ? '0.95rem' : '0.9rem',
                    fontWeight: dept.level === 0 ? '600' : '400',
                  }}
                  onMouseEnter={e => {
                    if (value !== dept.id) {
                      e.currentTarget.style.backgroundColor = '#f7fafc';
                    }
                  }}
                  onMouseLeave={e => {
                    if (value !== dept.id) {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }
                  }}
                >
                  {prefix}
                  {dept.name}
                </div>
              );
            })}
            {filteredDepartments.length === 0 && (
              <div
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  color: '#a0aec0',
                  fontSize: '0.875rem',
                }}
              >
                No departments found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
