/**
 * Script bloqueante injetado no <head> para evitar o flash de tema (FOUC).
 *
 * Roda ANTES do navegador pintar a primeira frame — lê o tema salvo em
 * localStorage (ou a preferência do sistema como fallback) e aplica
 * data-theme na raiz. Assim o React hidrata já com o tema correto e nunca
 * há o salto claro → escuro que aparecia quando o tema só era aplicado
 * dentro do useEffect do ThemeSelect.
 *
 * Mantém a MESMA chave e a MESMA lógica de fallback do ThemeSelect.
 */
export function ThemeScript() {
  const code = `(function(){try{var s=localStorage.getItem("life-manager-theme");var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="dark";}})();`;
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
