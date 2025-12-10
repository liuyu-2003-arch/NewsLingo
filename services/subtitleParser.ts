import { SubtitleSegment } from '../types';

export const parseSubtitleFile = async (file: File): Promise<SubtitleSegment[]> => {
  const text = await file.text();
  if (file.name.endsWith('.vtt')) {
    return parseVTT(text);
  } else {
    // Default to SRT parsing for .srt or others
    return parseSRT(text);
  }
};

const timeToSeconds = (timeString: string): number => {
  // Format: 00:00:00,000 or 00:00:00.000
  const parts = timeString.split(':');
  let seconds = 0;
  let minutes = 0;
  let hours = 0;

  if (parts.length === 3) {
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
    const secParts = parts[2].split(/[,.]/);
    seconds = parseInt(secParts[0], 10);
    const ms = parseInt(secParts[1], 10);
    return hours * 3600 + minutes * 60 + seconds + ms / 1000;
  } else if (parts.length === 2) {
    minutes = parseInt(parts[0], 10);
    const secParts = parts[1].split(/[,.]/);
    seconds = parseInt(secParts[0], 10);
    const ms = parseInt(secParts[1], 10);
    return minutes * 60 + seconds + ms / 1000;
  }
  return 0;
};

const parseSRT = (data: string): SubtitleSegment[] => {
  const segments: SubtitleSegment[] = [];
  // Normalize line endings
  const cleanData = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = cleanData.split('\n\n');

  let idCounter = 1;

  blocks.forEach((block) => {
    const lines = block.split('\n').filter(line => line.trim() !== '');
    if (lines.length >= 2) {
      // Often line 0 is index, line 1 is time, line 2+ is text
      // Or sometimes index is missing in malformed files
      let timeLineIndex = 0;
      if (lines[0].includes('-->')) {
        timeLineIndex = 0;
      } else if (lines[1] && lines[1].includes('-->')) {
        timeLineIndex = 1;
      } else {
        return; // Invalid block
      }

      const timeLine = lines[timeLineIndex];
      const [startStr, endStr] = timeLine.split(' --> ');
      
      if (!startStr || !endStr) return;

      const textLines = lines.slice(timeLineIndex + 1);
      // Join with newline to preserve structure (e.g. English line 1, Chinese line 2)
      const text = textLines.join('\n').replace(/<[^>]*>/g, ''); 

      segments.push({
        id: idCounter++,
        startTime: timeToSeconds(startStr.trim()),
        endTime: timeToSeconds(endStr.trim()),
        text: text,
      });
    }
  });

  return segments;
};

const parseVTT = (data: string): SubtitleSegment[] => {
  const segments: SubtitleSegment[] = [];
  const cleanData = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = cleanData.split('\n\n');
  
  let idCounter = 1;

  blocks.forEach(block => {
    const lines = block.split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0 || lines[0].startsWith('WEBVTT')) return;

    let timeLineIndex = 0;
     // Check if first line is an ID or the timestamp
    if (lines[0].includes('-->')) {
        timeLineIndex = 0;
    } else if (lines[1] && lines[1].includes('-->')) {
        timeLineIndex = 1;
    } else {
        return; 
    }

    const timeLine = lines[timeLineIndex];
    const [startStr, endStr] = timeLine.split(' --> ');

    if(!startStr || !endStr) return;

    const textLines = lines.slice(timeLineIndex + 1);
    // Join with newline to preserve structure
    const text = textLines.join('\n').replace(/<[^>]*>/g, ''); 

    segments.push({
        id: idCounter++,
        startTime: timeToSeconds(startStr.trim()),
        endTime: timeToSeconds(endStr.trim().split(' ')[0]), // Remove styling info after time
        text: text,
    });
  });

  return segments;
};

export const extractYoutubeId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};