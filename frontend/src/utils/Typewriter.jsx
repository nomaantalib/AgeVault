import React, { useState, useEffect } from 'react';

export const Typewriter = ({ text, speed = 40, delay = 0, className = '' }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    let timer;
    
    const startTyping = () => {
      let index = 0;
      timer = setInterval(() => {
        if (index < text.length) {
          setDisplayedText((prev) => prev + text.charAt(index));
          index++;
        } else {
          clearInterval(timer);
        }
      }, speed);
    };

    const delayTimer = setTimeout(startTyping, delay);
    
    return () => {
      clearTimeout(delayTimer);
      clearInterval(timer);
    };
  }, [text, speed, delay]);

  return <span className={className}>{displayedText}</span>;
};

export default Typewriter;
