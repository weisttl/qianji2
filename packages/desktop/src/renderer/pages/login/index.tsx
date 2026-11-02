import brandMark from '@renderer/assets/logos/brand/qianji-mark.svg';
import { Alert, Button, Checkbox, Input, Select } from '@arco-design/web-react';
import { ArrowRight, ChartLine, FileText, Lock, User } from '@icon-park/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/renderer/services/i18n';
import i18nConfig from '@/common/config/i18n-config.json';
import { useNavigate } from 'react-router-dom';
import AppLoader from '@renderer/components/layout/AppLoader';
import { useAuth } from '../../hooks/context/AuthContext';
import styles from './LoginPage.module.css';

const REMEMBER_ME_KEY = 'rememberMe';
const REMEMBERED_USERNAME_KEY = 'rememberedUsername';

// Decode legacy account hints without retaining the old password cache.
const decodeUsername = (text: string): string => {
  try {
    return decodeURIComponent(atob(text.split('').toReversed().join('')));
  } catch {
    return '';
  }
};

const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { status, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    localStorage.removeItem('rememberedPassword');
    const remembered = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
    if (remembered) {
      setUsername(decodeUsername(localStorage.getItem(REMEMBERED_USERNAME_KEY) || ''));
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') void navigate('/guid', { replace: true });
  }, [navigate, status]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submittingRef.current) return;
      const trimmedUsername = username.trim();
      if (!trimmedUsername || !password) {
        setMessage(t('login.errors.empty'));
        return;
      }
      submittingRef.current = true;
      setLoading(true);
      setMessage(null);
      try {
        const result = await login({ username: trimmedUsername, password, remember: rememberMe });
        if (result.success) {
          if (rememberMe) {
            localStorage.setItem(REMEMBER_ME_KEY, 'true');
            localStorage.setItem(
              REMEMBERED_USERNAME_KEY,
              btoa(encodeURIComponent(trimmedUsername)).split('').toReversed().join('')
            );
          } else {
            localStorage.removeItem(REMEMBER_ME_KEY);
            localStorage.removeItem(REMEMBERED_USERNAME_KEY);
          }
          setPassword('');
          void navigate('/guid', { replace: true });
        } else {
          const errorKeys = {
            invalidCredentials: 'login.errors.invalidCredentials',
            tooManyAttempts: 'login.errors.tooManyAttempts',
            networkError: 'login.errors.networkError',
            serverError: 'login.errors.serverError',
            csrfError: 'login.errors.unknown',
            unknown: 'login.errors.unknown',
          } as const;
          setMessage(t(errorKeys[result.code ?? 'unknown']));
        }
      } catch {
        setMessage(t('login.errors.networkError'));
      } finally {
        submittingRef.current = false;
        setLoading(false);
      }
    },
    [login, navigate, password, rememberMe, t, username]
  );

  if (status === 'checking') return <AppLoader />;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <img src={brandMark} alt='' width={38} height={38} />
          <span className={styles.organization}>{t('common.product.organization')}</span>
          <span className={styles.divider} aria-hidden='true' />
          <span className={styles.product}>{t('common.product.name')}</span>
        </div>
        <Select
          className={styles.language}
          aria-label={t('login.languageToggle')}
          value={i18n.language}
          options={i18nConfig.supportedLanguages.map((code) => ({
            value: code,
            label: new Intl.DisplayNames([code], { type: 'language' }).of(code) || code,
          }))}
          onChange={(language: string) => {
            void changeLanguage(language).catch(() => setMessage(t('login.errors.networkError')));
          }}
        />
      </header>

      <main className={styles.main}>
        <section className={styles.story}>
          <div className={styles.storyContent}>
            <span className={styles.eyebrow}>{t('common.product.loginEyebrow')}</span>
            <h1>{t('common.product.loginHeadline')}</h1>
            <p className={styles.intro}>{t('common.product.loginIntro')}</p>
            <div className={styles.artwork} aria-hidden='true'>
              <div className={styles.orbit} />
              <div className={styles.orbitInner} />
              <div className={styles.columnOne} />
              <div className={styles.columnTwo} />
              <div className={styles.columnThree} />
              <div className={styles.artworkCaption}>{t('common.product.name')}</div>
            </div>
            <div className={styles.capabilities}>
              {(
                [
                  { key: 'capabilityResearch', FeatureIcon: ChartLine },
                  { key: 'capabilityDocuments', FeatureIcon: FileText },
                  { key: 'capabilityData', FeatureIcon: ChartLine },
                ] as const
              ).map(({ key: featureKey, FeatureIcon }) => {
                return (
                  <div key={featureKey} className={styles.capability}>
                    <FeatureIcon size={20} fill='currentColor' />
                    <span>{t(`common.product.${featureKey}`)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.loginPanel} aria-labelledby='login-title'>
          <div className={styles.formCard}>
            <span className={styles.edition}>{t('common.product.edition')}</span>
            <img className={styles.mark} src={brandMark} alt={t('common.product.name')} width={52} height={52} />
            <h2 id='login-title'>{t('common.product.loginTitle')}</h2>
            <p className={styles.formDescription}>{t('common.product.loginDescription')}</p>
            <form onSubmit={(event) => void handleSubmit(event)} noValidate className={styles.form}>
              <div className={styles.field}>
                <label htmlFor='username'>{t('login.username')}</label>
                <Input
                  id='username'
                  name='username'
                  prefix={<User size={18} />}
                  placeholder={t('login.usernamePlaceholder')}
                  autoComplete='username'
                  autoFocus
                  value={username}
                  onChange={setUsername}
                  disabled={loading}
                  aria-required='true'
                />
              </div>
              <div className={styles.field}>
                <label htmlFor='password'>{t('login.password')}</label>
                <Input.Password
                  id='password'
                  name='password'
                  prefix={<Lock size={18} />}
                  placeholder={t('login.passwordPlaceholder')}
                  autoComplete='current-password'
                  value={password}
                  onChange={setPassword}
                  disabled={loading}
                  aria-required='true'
                />
              </div>
              <Checkbox checked={rememberMe} onChange={setRememberMe} disabled={loading}>
                {t('login.rememberMe')}
              </Checkbox>
              {message && <Alert type='error' content={message} />}
              <Button type='primary' htmlType='submit' long loading={loading} className={styles.submit}>
                {loading ? t('login.submitting') : t('login.submit')}
                {!loading && <ArrowRight size={18} fill='currentColor' />}
              </Button>
            </form>
            <p className={styles.support}>{t('common.product.support')}</p>
            <div className={styles.internal}>
              <span />
              {t('common.product.internalOnly')}
            </div>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <span>
          {t('common.product.organization')} · {t('common.product.name')}
        </span>
        <span>{t('common.product.usageNotice')}</span>
      </footer>
    </div>
  );
};

export default LoginPage;
