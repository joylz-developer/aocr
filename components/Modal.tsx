import React, { ReactNode, useRef } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    
    // Мы используем ref, чтобы отслеживать, началось ли событие mousedown на фоне.
    // Это предотвращает закрытие модального окна, если пользователь нажимает внутри модального окна,
    // перетаскивает курсор наружу и отпускает кнопку мыши.
    const mouseDownOnBackdrop = useRef(false);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        // Проверяем, начался ли клик непосредственно на элементе фона.
        if (e.target === e.currentTarget) {
            mouseDownOnBackdrop.current = true;
        }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
        // Если клик начался на фоне, а также закончился на фоне, закрываем модальное окно.
        if (mouseDownOnBackdrop.current && e.target === e.currentTarget) {
            onClose();
        }
        // Сбрасываем ref для следующего взаимодействия с кликом.
        mouseDownOnBackdrop.current = false;
    };


    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" 
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
        >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
                    <h2 className="text-xl font-semibold">{title}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;