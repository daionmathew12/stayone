import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const BannerMessage = ({ message, onClose, autoDismiss = true, duration = 5000 }) => {
  useEffect(() => {
    if (autoDismiss && message.text) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message.text, autoDismiss, duration, onClose]);

  if (!message || !message.text) return null;

  const formatText = (content) => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && item.msg) {
            const field = Array.isArray(item.loc) && item.loc.length > 0 ? item.loc[item.loc.length - 1] : "";
            return field && field !== 'body' ? `${field}: ${item.msg}` : item.msg;
          }
          return JSON.stringify(item);
        })
        .join(', ');
    }
    if (typeof content === 'object') {
      return content.msg || content.message || JSON.stringify(content);
    }
    return String(content);
  };

  const displayText = formatText(message.text);
  if (!displayText) return null;

  const isSuccess = message.type === 'success';
  const bgColor = isSuccess ? 'bg-green-600' : 'bg-red-600';
  const icon = isSuccess ? '✅' : '❌';

  return (
    <div className={`fixed top-4 right-4 z-[9999] ${bgColor} text-white shadow-xl rounded-lg max-w-sm`}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="mr-2 text-sm">{icon}</span>
            <span className="text-sm font-medium">{displayText}</span>
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BannerMessage;
