import React, { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

interface Option {
  id: string | number;
  label: string;         // Il testo VISIBILE NELLA CASELLA (es. Solo il Codice)
  searchString?: string; // Stringa nascosta per LA RICERCA (es. Codice + Descrizione)
  [key: string]: any;
}

interface FastAutocompleteProps {
  options: Option[];
  value: string | number;
  onChange: (id: string | number, option: Option | null) => void;
  placeholder?: string;
  className?: string;
  dropdownClassName?: string;
  disabled?: boolean;
  renderOption?: (opt: Option) => React.ReactNode;
}

export default function FastAutocomplete({ options = [], value, onChange, placeholder, className, dropdownClassName, disabled, renderOption }: FastAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!isTypingRef.current) {
      const selected = options.find(o => String(o.id) === String(value));
      setInputValue(selected ? selected.label : '');
    }
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        isTypingRef.current = false;
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const typedValue = e.target.value;
    const isDelete = (e.nativeEvent as any).inputType?.startsWith('delete');

    setInputValue(typedValue); 
    setShowDropdown(true);
    isTypingRef.current = true;

    if (typedValue.length > 0) {
      if (!isDelete) {
        // Autocompleta SOLO se digita l'inizio della Label (Il codice)
        const matchStartsWith = options.find(o => o.label.toLowerCase().startsWith(typedValue.toLowerCase()));
        if (matchStartsWith) {
          setInputValue(matchStartsWith.label);
          onChange(matchStartsWith.id, matchStartsWith); 
          setTimeout(() => {
            if (inputRef.current) inputRef.current.setSelectionRange(typedValue.length, matchStartsWith.label.length);
          }, 0);
          return; 
        }
      }
      onChange('', null);
    } else {
      onChange('', null);
    }
  };

  const jumpToNextField = (direction: 1 | -1 = 1) => {
    const inputElements = 'input:not([type="hidden"]):not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"])';
    const elements = Array.from(document.querySelectorAll(inputElements)) as HTMLElement[];
    const currentIndex = elements.indexOf(inputRef.current as HTMLElement);
    
    if (currentIndex > -1) {
      let nextIndex = currentIndex + direction;
      while (nextIndex >= 0 && nextIndex < elements.length) {
        if (elements[nextIndex].offsetParent !== null) {
          elements[nextIndex].focus();
          break;
        }
        nextIndex += direction;
      }
    }
    setShowDropdown(false);
    isTypingRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault(); 
      const direction = (e.shiftKey && e.key === 'Tab') ? -1 : 1; 
      jumpToNextField(direction);
    }
  };

  const handleOptionClick = (option: Option) => {
    setInputValue(option.label);
    onChange(option.id, option);
    setShowDropdown(false);
    isTypingRef.current = false;
    jumpToNextField(1); 
  };

  // Cerca la stringa SIA nel codice CHE nella descrizione (searchString)
  const filteredOptions = (options || []).filter(o => 
    (o.searchString || o.label).toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef} type="text" value={inputValue} onChange={handleInputChange} onKeyDown={handleKeyDown}
          onFocus={() => { setShowDropdown(true); isTypingRef.current = true; }} placeholder={placeholder || 'Cerca...'} disabled={disabled}
          className={`w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-semibold ${className}`}
        />
      </div>

      {showDropdown && !disabled && (
        /* FIX: min-w-full permette alla tendina di allargarsi oltre la cella! */
        <div ref={dropdownRef} className={`absolute z-[200] mt-1 bg-card border border-border rounded-lg shadow-xl scrollbar-thin min-w-full ${dropdownClassName || 'max-h-56 overflow-y-auto'}`}>
          {filteredOptions.length > 0 ? (
            filteredOptions.slice(0, 50).map((opt) => ( 
              <div
                key={opt.id} onMouseDown={(e) => { e.preventDefault(); handleOptionClick(opt); }}
                className="px-4 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer border-b border-border/50 last:border-0"
              >
                {renderOption ? renderOption(opt) : <div className="truncate">{opt.label}</div>}
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground italic text-center">Nessuna corrispondenza...</div>
          )}
        </div>
      )}
    </div>
  );
}