export function ProjectDomain() {
  return (
    <label>
      Àmbit
      <input
        name="category"
        list="project-domain-suggestions"
        required
        maxLength={100}
        defaultValue="Innovació"
        aria-describedby="project-domain-help"
      />
      <datalist id="project-domain-suggestions">
        {[
          "Arts i cultura", "Humanitats", "Ciència i recerca", "Educació",
          "Tecnologia", "Enginyeria", "Salut i benestar", "Sostenibilitat",
          "Comunitat", "Economia i empresa", "Disseny", "Arquitectura",
          "Moda", "Interdisciplinari",
        ].map((domain) => <option key={domain} value={domain} />)}
      </datalist>
      <small id="project-domain-help">
        Escriu el teu àmbit o combina disciplines. Les propostes també poden
        ser artístiques, científiques, socials o acadèmiques.
      </small>
    </label>
  );
}
