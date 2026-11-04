import {tr} from './i18n.js';

export function setupPasswordConfirmation(password,confirmation,error) {
  let active=false;
  function validate() {
    const mismatch=active && confirmation.value!=='' && password.value!==confirmation.value;
    const message=mismatch?tr('两次输入的密码不一致，请重新确认。','Passwords do not match. Please confirm again.'):'';
    confirmation.setCustomValidity(message);
    confirmation.setAttribute('aria-invalid',String(mismatch));
    error.textContent=message;
    error.hidden=!mismatch;
  }
  password.addEventListener('input',validate);
  confirmation.addEventListener('input',validate);
  return {
    mode(enabled,preserve=false) {
      active=enabled;
      confirmation.closest('label').hidden=!enabled;
      confirmation.required=enabled;
      confirmation.disabled=!enabled;
      if(!preserve || !enabled) confirmation.value='';
      validate();
    },
    check() {
      validate();
      return !active || confirmation.reportValidity();
    },
    clear() {confirmation.value='';validate();}
  };
}
