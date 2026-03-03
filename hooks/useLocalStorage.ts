
import { useState, useEffect } from 'react';

export function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            if (!item) {
                return initialValue;
            }
            
            const parsedItem = JSON.parse(item);

            // If the initial value is a Set, reconstruct the Set from the stored array
            if (initialValue instanceof Set) {
                return new Set(parsedItem) as T;
            }

            return parsedItem;

        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    useEffect(() => {
        try {
            // If the value is a Set, convert it to an array for serialization
            const valueToStore = storedValue instanceof Set ? Array.from(storedValue) : storedValue;
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    }, [key, storedValue]);

    return [storedValue, setStoredValue];
}
