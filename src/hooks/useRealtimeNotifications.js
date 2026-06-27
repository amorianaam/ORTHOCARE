import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { getSocket, joinRoom } from '../utils/socket';

/**
 * useRealtimeNotifications — connects to Socket.IO and listens to role-specific events.
 * Call this once at the top-level component (e.g., Layout or App).
 * @param {string} role - user role string
 */
const useRealtimeNotifications = (role) => {
  const attached = useRef(false);

  useEffect(() => {
    if (!role || attached.current) return;
    attached.current = true;

    const socket = getSocket();
    joinRoom(role);

    // ── Cashier: new patient registered by secretary ──
    socket.on('patient:registered', ({ patientName }) => {
      toast.info(`🧑‍⚕️ مريض جديد: ${patientName}`, {
        position: 'bottom-right',
        autoClose: 6000,
        icon: false,
      });
    });

    // ── Doctor: patient moved to waiting ──
    socket.on('patient:waiting', ({ message }) => {
      toast.success(`🔔 ${message}`, {
        position: 'bottom-right',
        autoClose: 5000,
        icon: false,
      });
    });

    // ── Lab: new paid request ──
    socket.on('request:new', ({ message }) => {
      toast.warning(`🧪 ${message}`, {
        position: 'bottom-right',
        autoClose: 5000,
        icon: false,
      });
    });

    // ── Doctor: lab completed ──
    socket.on('lab:completed', ({ message }) => {
      toast.success(`🧪 ${message}`, {
        position: 'bottom-right',
        autoClose: 6000,
        icon: false,
      });
    });

    // ── Doctor: radiology completed ──
    socket.on('radiology:completed', ({ message }) => {
      toast.success(`☢️ ${message}`, {
        position: 'bottom-right',
        autoClose: 6000,
        icon: false,
      });
    });

    // ── Surgery Coordinator: new referral ──
    socket.on('surgery:new_referral', ({ message }) => {
      toast.info(`🏥 ${message}`, {
        position: 'bottom-right',
        autoClose: 6000,
        icon: false,
      });
    });

    // ── Surgery Coordinator: payment received ──
    socket.on('surgery:payment_received', ({ message }) => {
      toast.success(`💰 ${message}`, {
        position: 'bottom-right',
        autoClose: 6000,
        icon: false,
      });
    });

    // ── Backup notifications ──
    socket.on('backup:done', ({ file }) => {
      toast.success(`💾 نسخ احتياطي: ${file}`, { autoClose: 8000 });
    });
    socket.on('backup:failed', ({ message }) => {
      toast.error(`❌ ${message}`, { autoClose: 8000 });
    });

    return () => {
      socket.off('patient:registered');
      socket.off('patient:waiting');
      socket.off('request:new');
      socket.off('lab:completed');
      socket.off('radiology:completed');
      socket.off('surgery:new_referral');
      socket.off('surgery:payment_received');
      socket.off('backup:done');
      socket.off('backup:failed');
      attached.current = false;
    };
  }, [role]);
};

export default useRealtimeNotifications;
