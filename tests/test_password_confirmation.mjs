import test from 'node:test';
import assert from 'node:assert/strict';
import {setupPasswordConfirmation} from '../app/static/password-confirmation.js';
import {setPreferences} from '../app/static/preferences.js';
function input() {
 const label={hidden:false},listeners={};
 return {value:'',required:false,disabled:false,validity:'',attrs:{},label,
  addEventListener(name,fn){listeners[name]=fn;},closest(){return label;},
  setCustomValidity(text){this.validity=text;},setAttribute(k,v){this.attrs[k]=v;},
  reportValidity(){return !this.validity && (!this.required || !!this.value);},
  type(value){this.value=value;listeners.input?.();}};
}
function fields() {
 const password=input(),confirm=input(),error={hidden:true,textContent:''};
 return {password,confirm,error,flow:setupPasswordConfirmation(password,confirm,error)};
}
test('password setup requires confirmation, rejects mismatch and accepts matching values',()=>{
 const {password,confirm,error,flow}=fields();flow.mode(true);password.type('a-new-password');
 assert.equal(confirm.required,true);assert.equal(flow.check(),false);
 confirm.type('a-new-passw0rd');assert.equal(flow.check(),false);
 assert.match(error.textContent,/两次输入的密码不一致/);assert.equal(confirm.attrs['aria-invalid'],'true');
 confirm.type('a-new-password');assert.equal(flow.check(),true);assert.equal(error.hidden,true);
});
test('editing the original password revalidates confirmation and treats spaces literally',()=>{
 const {password,confirm,flow}=fields();flow.mode(true);password.type('abc def');confirm.type('abc def');
 assert.equal(flow.check(),true);password.type('abc def ');assert.equal(flow.check(),false);
 confirm.type('abc def ');assert.equal(flow.check(),true);
});
test('login and passkey modes disable confirmation and clear stale mismatches and secrets',()=>{
 const {password,confirm,error,flow}=fields();flow.mode(true);password.type('original');confirm.type('mismatch');
 flow.mode(false);assert.equal(confirm.disabled,true);assert.equal(confirm.label.hidden,true);
 assert.equal(confirm.required,false);assert.equal(confirm.value,'');assert.equal(error.hidden,true);assert.equal(flow.check(),true);
 flow.mode(true);assert.equal(confirm.value,'');assert.equal(flow.check(),false);
});
test('language refresh preserves typed confirmation, translates validation, and success clears it',()=>{
 const {password,confirm,error,flow}=fields();flow.mode(true);password.type('original');confirm.type('mismatch');
 setPreferences({language:'en'});flow.mode(true,true);
 assert.equal(confirm.value,'mismatch');assert.match(error.textContent,/Passwords do not match/);
 flow.clear();assert.equal(confirm.value,'');assert.equal(confirm.validity,'');
 setPreferences({language:'zh-CN'});
});
