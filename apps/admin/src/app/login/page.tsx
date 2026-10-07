import Image from "next/image";
import { redirect } from "next/navigation";

import { getCmsContext } from "@/lib/auth";
import { SignInButton } from "./sign-in-button";
import styles from "./auth-shell.module.css";

export default async function LoginPage() {
  const context = await getCmsContext();
  if (context.status === "authenticated") redirect("/");

  return (
    <main className={styles.authShell}>
      <section className={styles.loginContent} aria-labelledby="login-title">
        <div className={styles.brandMark}>
          <Image
            src="/nite-editorial-glyph.png"
            alt="Símbolo do NITE CMS"
            width={74}
            height={74}
            priority
          />
        </div>

        <header className={styles.intro}>
          <h1 id="login-title">Bem-Vindo à redação</h1>
          <p>
            Entre com sua conta institucional para criar, revisar e publicar
            matérias.
          </p>
        </header>

        {context.status === "unconfigured" ? (
          <div className={styles.statusNotice}>
            <p className={styles.statusTitle}>Configuração pendente</p>
            <p>
              Defina no ambiente de execução: {context.missing.join(", ")}.
              Nenhum valor sensível é exibido nesta tela.
            </p>
          </div>
        ) : context.status === "forbidden" ? (
          <p role="alert" className={styles.forbiddenNotice}>
            Sua conta Microsoft foi autenticada, mas não possui acesso editorial
            ativo ou ainda não concluiu um convite válido.
          </p>
        ) : (
          <SignInButton />
        )}

        <p className={styles.accessNote}>
          Acesso restrito à equipe autorizada do NITE
        </p>
      </section>
    </main>
  );
}
