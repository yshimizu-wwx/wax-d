'use client';

import { useRef, useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import type { EventInput } from '@fullcalendar/core';
import { Calendar } from 'lucide-react';

interface WorkCalendarProps {
  /** 業者ID。この業者の案件・申込のみ表示 */
  providerId: string;
  /** 案件一覧（start_date, end_date, final_date, campaign_title, location, id） */
  projects: Array<{
    id: string;
    start_date?: string | null;
    end_date?: string | null;
    final_date?: string | null;
    campaign_title?: string | null;
    location?: string | null;
    status?: string | null;
  }>;
  /** 申込一覧（campaign_id, confirmed_date, id） */
  bookings?: Array<{
    id: string;
    campaign_id: string;
    confirmed_date?: string | null;
    applied_at?: string | null;
  }>;
  /** 高さ（CSS） */
  height?: string | number;
}

export default function WorkCalendar({
  providerId,
  projects,
  bookings = [],
  height = 500,
}: WorkCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const events: EventInput[] = [];

  projects.forEach((p) => {
    const title = (p.campaign_title || p.location || p.id) || '案件';
    const start = p.final_date || p.start_date;
    const end = p.end_date || p.final_date || p.start_date;
    if (start) {
      events.push({
        id: `proj-${p.id}`,
        title: `📋 ${title}`,
        start: start,
        end: end ? (end === start ? undefined : end) : undefined,
        allDay: true,
        extendedProps: { type: 'project', projectId: p.id, status: p.status },
      });
    }
  });

  bookings.forEach((b) => {
    const date = b.confirmed_date || (b.applied_at ? b.applied_at.split('T')[0] : null);
    if (date) {
      events.push({
        id: `book-${b.id}`,
        title: `申込 #${b.id.slice(-6)}`,
        start: date,
        allDay: true,
        extendedProps: { type: 'booking', bookingId: b.id, campaignId: b.campaign_id },
      });
    }
  });

  if (!mounted) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
        <div className="flex items-center gap-2 text-slate-500">
          <Calendar className="w-6 h-6 animate-pulse" />
          <span>カレンダーを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listWeek',
        }}
        buttonText={{
          today: '今日',
          month: '月',
          week: '週',
          list: 'リスト',
        }}
        locale="ja"
        events={events}
        height={height}
        eventDisplay="block"
        dayMaxEvents={4}
      />
    </div>
  );
}
