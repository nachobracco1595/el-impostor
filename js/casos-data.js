/* Casos para "Detectives". Cada caso: 4 sospechosos, 3 actos y un final distinto según a quién se arresta.
   Pista: { t: "prueba" | "testimonio" | "documento", titulo, texto }
   Acto: una pista pública, tres privadas (se reparten entre los jugadores) y dos lugares para investigar (eligen uno). */
const P = (t, titulo, texto) => ({ t, titulo, texto });

const CASOS = [
  {
    id: "collar", titulo: "El collar de la abuela Rosa", lugar: "Estancia La Paloma · sábado, 21:30", dificultad: 1, emoji: "💎",
    teaser: "Un collar de esmeraldas desaparece en plena cena de cumpleaños.",
    intro: [
      "La familia Herrera se reunió en la estancia para los 80 años de la abuela Rosa. A las 21:00, antes del postre, Rosa subió a buscar su chal y vio su collar de esmeraldas en el joyero. A las 21:30, cuando volvió a subir, el joyero estaba abierto y vacío.",
      "La ventana del cuarto estaba abierta de par en par. Por el temporal, la policía rural tardará horas en llegar: la familia les pide a ustedes que averigüen quién fue."
    ],
    sospechosos: [
      { id: "a", nombre: "Tomás Herrera", rol: "Nieto, músico", desc: "Tocó el piano durante la cena. Le debe dinero a medio mundo.", motivo: "Deudas", color: "#4dabf7", acc: ["gorra"] },
      { id: "b", nombre: "Lucía Benítez", rol: "Enfermera de Rosa", desc: "Cuida a la abuela hace dos años. Rosa le prometió dejarle algo en el testamento.", motivo: "Herencia", color: "#f06595", acc: ["cofia"] },
      { id: "c", nombre: "Don Ernesto", rol: "Jardinero", desc: "Trabaja en la estancia hace 30 años. Rosa quería jubilarlo el mes que viene.", motivo: "Rencor", color: "#94d82d", acc: ["sombrero", "bigote"] },
      { id: "d", nombre: "Valeria Sosa", rol: "Nuera, dueña de un catering", desc: "Organizó la cena y trajo la torta. Llegó tarde y muy nerviosa.", motivo: "Ninguno conocido", color: "#cc5de8", acc: ["pelo", "collar"] }
    ],
    culpable: "d",
    actos: [
      {
        titulo: "La escena",
        publica: P("prueba", "El joyero", "El joyero no está forzado: lo abrieron con su llave. La llavecita cuelga del llavero de Rosa, junto con la llave de la vitrina de la vajilla."),
        privadas: [
          P("testimonio", "Lo que dice la abuela", "Rosa: «Durante la cena tuve un mareo. Lucía no se movió de mi lado desde las nueve hasta que subí a las nueve y media. Me tomaba el pulso a cada rato.»"),
          P("prueba", "La ventana", "Hay barro en el marco de la ventana, pero del lado de adentro del cuarto. Afuera, en el borde, no hay ninguna marca."),
          P("testimonio", "El piano", "Varios invitados confirman que Tomás tocó el piano sin parar desde las 21:00 hasta las 21:20. Después salió al porche delantero.")
        ],
        opciones: [
          { lugar: "El cantero bajo la ventana", pista: P("prueba", "Tierra sin huellas", "Llovió toda la tarde y la tierra del cantero está blanda como barro. No hay ni una sola huella: nadie entró ni salió por esa ventana.") },
          { lugar: "El porche delantero", pista: P("prueba", "Colillas en el porche", "Tres colillas recién apagadas y marcas de alguien que caminó de un lado a otro, como quien habla un buen rato por teléfono.") }
        ]
      },
      {
        titulo: "Las coartadas",
        publica: P("testimonio", "¿Quién dejó la mesa?", "Entre las 21:00 y las 21:30 dejaron la mesa Tomás (al porche, 21:20) y Valeria (dijo que iba a la cocina a ver el postre, de 21:12 a 21:25). Don Ernesto ya no estaba: se despidió a las 20:30."),
        privadas: [
          P("documento", "El celular de Tomás", "El registro de llamadas de Tomás muestra una llamada con su novia de 21:21 a 21:37. Ella confirma que él le contó de la cena todo el rato."),
          P("documento", "Boleto de colectivo", "Don Ernesto muestra el boleto del colectivo al pueblo de las 20:45. El chofer lo conoce y confirma que viajó. Volvió recién a las 22:00, cuando lo llamaron."),
          P("testimonio", "La vajilla", "La empleada recuerda que a las 20:00 Valeria le pidió el llavero a Rosa «para sacar los platos buenos de la vitrina». No sabe cuándo lo devolvió.")
        ],
        opciones: [
          { lugar: "La cocina", pista: P("testimonio", "La cocinera", "«¿Valeria? No vino a la cocina en toda la noche. Yo estuve sola acá desde las nueve, emplatando el postre que ella trajo.»") },
          { lugar: "El cuarto de Tomás", pista: P("documento", "Recibo de empeño", "Un recibo por empeñar una guitarra eléctrica, con fecha del mes pasado. Tomás admite que la empeñó para pagar deudas y le da vergüenza contarlo.") }
        ]
      },
      {
        titulo: "Los detalles",
        publica: P("prueba", "El perfume", "Al entrar al cuarto de Rosa, varios notan un olor fuerte a jazmín. No es el perfume de la abuela."),
        privadas: [
          P("testimonio", "Lucía y el jazmín", "Lucía: «Yo no uso perfume, en el hospital no nos dejan. Pero ese olor a jazmín lo sentí cuando Valeria me saludó con un abrazo al llegar.»"),
          P("documento", "Cartas del banco", "En el auto de Valeria hay cartas del banco: su empresa de catering debe varios meses de alquiler y está por cerrar."),
          P("prueba", "Las botas del jardinero", "Las botas de Don Ernesto tienen barro del cantero. Él dice que pasó la tarde plantando rosas bajo la lluvia, antes de irse.")
        ],
        opciones: [
          { lugar: "La caja de la torta", pista: P("prueba", "Doble fondo", "La caja de la torta que trajo Valeria tiene un cartón suelto en el fondo. Debajo hay un hueco del tamaño de un collar y un hilito de terciopelo verde, como el forro del joyero.") },
          { lugar: "El galpón", pista: P("prueba", "El balde del galpón", "Las herramientas de Don Ernesto están limpias. En el balde hay barro del cantero con la marca de una mano chica, que sacó un puñado hace poco.") }
        ]
      }
    ],
    solucion: "Valeria lo planeó. A las 20:00 pidió el llavero de Rosa con la excusa de la vajilla. A las 21:12 dejó la mesa diciendo que iba a la cocina, pero la cocinera nunca la vio: subió al cuarto, abrió el joyero con la llave y escondió el collar en el doble fondo de la caja de la torta. Para culpar a alguien de afuera, abrió la ventana y untó barro del galpón en el marco… del lado de adentro. Su empresa estaba por quebrar.",
    finales: {
      a: "Tomás pasa la noche encerrado en la biblioteca jurando que es inocente. Dos semanas después, el collar aparece a la venta en una joyería de Buenos Aires. El joyero recuerda a una mujer elegante con perfume de jazmín…",
      b: "Rosa despide a Lucía entre lágrimas. Un mes después, la abuela se cae y no hay nadie a su lado. Mientras tanto, el catering de Valeria paga todas sus deudas de golpe…",
      c: "Don Ernesto deja la estancia después de 30 años, con su boleto de colectivo todavía en el bolsillo. Nadie vuelve a cuidar las rosas. Y Valeria, misteriosamente, cambia de auto.",
      d: "Frente a la caja de la torta, Valeria se quiebra: «Iba a devolverlo cuando la empresa se recuperara». Rosa recupera su collar y, para sorpresa de todos, le ofrece a Valeria un préstamo con una condición: que nunca más toque su joyero."
    }
  },

  {
    id: "museo", titulo: "Apagón en el museo", lugar: "Museo de Bellas Artes del Sur · viernes, 22:00", dificultad: 2, emoji: "🖼️",
    teaser: "Cinco minutos a oscuras y un cuadro de dos millones desaparece.",
    intro: [
      "Gala de reapertura del museo. La estrella de la noche es «La dama del río», un cuadro valuado en dos millones de dólares. A las 22:00 en punto se cortó la luz. Cinco minutos después volvió… y el marco estaba vacío: alguien recortó la tela.",
      "Con el apagón, las puertas de seguridad se trabaron. Nadie salió del edificio: el ladrón y el cuadro siguen adentro."
    ],
    sospechosos: [
      { id: "a", nombre: "Bruno Salas", rol: "Guardia de seguridad", desc: "Hace el turno noche. Hace un mes le negaron un aumento.", motivo: "Dinero", color: "#748ffc", acc: ["gorra"] },
      { id: "b", nombre: "Inés Ferro", rol: "Curadora", desc: "Eligió el cuadro para la muestra. Antes trabajó años como restauradora.", motivo: "Ninguno conocido", color: "#20c997", acc: ["pelo", "lentes"] },
      { id: "c", nombre: "Mateo Ríos", rol: "Electricista", desc: "Montó las luces de la gala. Tiene antecedentes por un robo menor hace diez años.", motivo: "Antecedentes", color: "#ff922b", acc: ["casco"] },
      { id: "d", nombre: "Octavio Linares", rol: "Coleccionista", desc: "Intentó comprar el cuadro tres veces. El museo siempre le dijo que no.", motivo: "Obsesión", color: "#fcc419", acc: ["galera", "bigote"] }
    ],
    culpable: "b",
    actos: [
      {
        titulo: "El apagón",
        publica: P("prueba", "La caja de fusibles", "El corte no fue una falla: alguien bajó la palanca general a mano. La sala de fusibles solo se abre con tarjeta magnética."),
        privadas: [
          P("documento", "Registro de tarjetas", "La tarjeta que abrió la sala de fusibles a las 21:58 es la de Mateo Ríos."),
          P("prueba", "El corte de la tela", "La tela se cortó a un dedo del borde del marco, con un trazo recto y prolijo, sin dañar la pintura. Es el trabajo de alguien con muchísima práctica."),
          P("testimonio", "El discurso", "A las 22:00 Octavio estaba en el escenario dando un discurso. Doscientas personas lo escucharon seguir hablando a oscuras, sin cortarse, hasta que volvió la luz.")
        ],
        opciones: [
          { lugar: "El piso de la sala", pista: P("prueba", "Puntos que brillan", "Con la luz apagada aparecen puntitos de cinta fluorescente en el piso. Marcan un camino desde la sala de fusibles hasta el cuadro: alguien preparó la ruta para moverse a oscuras.") },
          { lugar: "La sala de seguridad", pista: P("documento", "La radio de Bruno", "La grabación de la radio muestra a Bruno pidiendo ayuda desde la sala de seguridad a las 22:01, 22:02 y 22:04. Esa sala está en el subsuelo, lejos del cuadro.") }
        ]
      },
      {
        titulo: "La tarjeta",
        publica: P("testimonio", "Mateo se defiende", "Mateo jura que perdió su tarjeta magnética esa misma tarde y que avisó enseguida para que la dieran de baja."),
        privadas: [
          P("documento", "Mensaje de Mateo", "En el celular de Mateo hay un mensaje de las 18:04: «Perdí mi tarjeta, ¿la pueden dar de baja?». Se lo mandó a la curadora, Inés Ferro. Ella contestó: «Ya me ocupo»."),
          P("documento", "Sistema de tarjetas", "La tarjeta de Mateo nunca fue dada de baja. Solo la curadora y el director pueden hacerlo, y el director está de viaje."),
          P("testimonio", "Octavio y el cuadro", "Octavio admite que quería el cuadro: «Yo compro, no robo». Su abogado tiene preparada una nueva oferta de compra para el lunes.")
        ],
        opciones: [
          { lugar: "El taller de restauración", pista: P("prueba", "El rollo de cinta", "En el taller de restauración, que usa solo Inés, hay un rollo de la misma cinta fluorescente casi terminado y un bisturí de restaurador recién limpiado.") },
          { lugar: "La camioneta de Mateo", pista: P("prueba", "Herramientas de Mateo", "Pinzas, cables y un cúter oxidado con la hoja mellada. Con eso sería imposible hacer un corte tan limpio.") }
        ]
      },
      {
        titulo: "La salida",
        publica: P("documento", "Envíos del lunes", "La lista de envíos del lunes tiene un solo paquete: un tubo con «material de restauración» para un taller de Montevideo."),
        privadas: [
          P("testimonio", "Dónde estaba Inés", "Inés dice que durante el apagón estaba en el baño. Una invitada que estaba en ese baño asegura que ahí no había nadie más."),
          P("documento", "Correo borrado", "En la papelera del correo de Inés hay un mensaje de un comprador anónimo: «El viernes, como acordamos. La mitad ahora y la otra mitad cuando llegue a Montevideo»."),
          P("prueba", "La linterna del guardia", "La linterna de Bruno no tiene pilas hace días. Él lo había reportado por escrito el lunes.")
        ],
        opciones: [
          { lugar: "El tubo de envío", pista: P("prueba", "Dentro del tubo", "Envuelta en papel de seda y enrollada con técnica de restaurador: «La dama del río», intacta.") },
          { lugar: "El auto de Octavio", pista: P("prueba", "El auto de Octavio", "Solo hay un catálogo de la muestra lleno de anotaciones y una chequera. Nada más.") }
        ]
      }
    ],
    solucion: "Inés lo preparó todo. Cuando Mateo le avisó que había perdido su tarjeta, no la dio de baja: la usó a las 21:58 para entrar a la sala de fusibles. Antes había marcado con cinta fluorescente el camino hasta el cuadro para moverse a oscuras. Recortó la tela con su bisturí de restauradora, a un dedo del marco, y la escondió en un tubo de «material de restauración» que salía el lunes hacia su comprador en Montevideo.",
    finales: {
      a: "Bruno pierde su trabajo y su reputación. El lunes, un tubo de «material de restauración» sale tranquilamente del museo rumbo a Montevideo. «La dama del río» nunca vuelve a verse en público.",
      b: "Cuando abren el tubo, Inés no dice nada: se sienta y se saca los guantes. «La dama del río» vuelve a su marco esa misma semana, con una pequeña marca en el borde que los restauradores apodan «la firma de Inés».",
      c: "Mateo va preso por sus antecedentes y por su tarjeta. Él siempre dijo que la había perdido. Meses después, un coleccionista de Montevideo muestra en privado un cuadro muy parecido a «La dama del río»…",
      d: "Los abogados de Octavio desarman la acusación en una semana: doscientas personas lo escucharon hablar durante el apagón. El museo queda en ridículo y el cuadro cruza el río sin que nadie lo detenga."
    }
  },

  {
    id: "tren", titulo: "El Expreso Patagónico", lugar: "Tren nocturno a Bariloche · martes, 23:30", dificultad: 3, emoji: "🚂",
    teaser: "Un empresario dormido para siempre… casi. El culpable sigue a bordo.",
    intro: [
      "Ramón Quiroga, dueño de una cadena de hoteles, viaja en el tren nocturno a Bariloche. A las 23:30 el camarero lo encuentra desmayado en su camarote: alguien le puso una dosis enorme de somníferos en el té. Está vivo, pero no despertará hasta mañana.",
      "El tren no para hasta el amanecer. El culpable sigue a bordo y ustedes tienen hasta la próxima estación para descubrirlo."
    ],
    sospechosos: [
      { id: "a", nombre: "Sofía Arce", rol: "Socia de Ramón", desc: "Fundó la cadena de hoteles con él hace 20 años. Viaja en el camarote de al lado.", motivo: "Ninguno conocido", color: "#e8e8e8", acc: ["pelo", "lentes"] },
      { id: "b", nombre: "Julián Paz", rol: "Camarero", desc: "Le llevó el té a Ramón a las 23:00. Ramón lo humilló delante de todos en la cena.", motivo: "Humillación", color: "#ff6b6b", acc: ["mono"] },
      { id: "c", nombre: "Dra. Paula Vidal", rol: "Médica", desc: "Viaja sola. En su bolso lleva varios medicamentos, entre ellos somníferos.", motivo: "Ninguno conocido", color: "#3bc9db", acc: ["pelo", "collar"] },
      { id: "d", nombre: "Germán Quiroga", rol: "Hijo de Ramón", desc: "Discutió a los gritos con su padre por la herencia durante la cena.", motivo: "Herencia", color: "#a9746e", acc: ["barba"] }
    ],
    culpable: "a",
    actos: [
      {
        titulo: "El té",
        publica: P("prueba", "La taza", "En la taza quedan restos de té con limón y un polvo blanco que no terminó de disolverse: somníferos molidos."),
        privadas: [
          P("testimonio", "El camarero", "Julián: «Preparé el té delante de la cocinera, solo con limón. Ramón estaba al teléfono y me dijo que lo dejara en la bandeja de la puerta. Eso hice a las 23:00.»"),
          P("testimonio", "La cocinera", "La cocinera confirma que Julián preparó el té frente a ella y que no le puso nada más que limón."),
          P("documento", "La llamada de Ramón", "El celular de Ramón muestra una llamada de 23:00 a 23:12. Recién después entró la bandeja: la taza estuvo doce minutos sola en el pasillo.")
        ],
        opciones: [
          { lugar: "El pasillo del vagón", pista: P("prueba", "El tacho del pasillo", "En el tacho del pasillo hay un sobrecito de azúcar del vagón comedor, abierto y doblado. Adentro quedan restos del mismo polvo blanco.") },
          { lugar: "El vagón comedor", pista: P("testimonio", "La discusión", "Varios pasajeros escucharon a Germán gritarle a su padre en la cena: «¡Te vas a llevar todo a la tumba!». Después se fue al vagón bar.") }
        ]
      },
      {
        titulo: "Los somníferos",
        publica: P("testimonio", "La médica", "La Dra. Vidal cuenta que a las 20:00 notó que le faltaba una tira de somníferos del bolso y se lo avisó al guarda."),
        privadas: [
          P("documento", "Libro del guarda", "En el libro del guarda figura: «20:05 — La pasajera Vidal reporta el robo de medicamentos de su bolso». Fue tres horas antes del ataque."),
          P("testimonio", "La cena", "En la cena, la Dra. Vidal compartió mesa con Sofía Arce. La médica dejó el bolso colgado en la silla y fue al baño un momento."),
          P("testimonio", "El vagón bar", "Tres pasajeros juran que Germán jugó al truco con ellos en el vagón bar desde las 22:30 hasta pasada la medianoche. Perdió bastante plata.")
        ],
        opciones: [
          { lugar: "La cabina del guarda", pista: P("testimonio", "Lo que vio el guarda", "«A las 23:05 vi a la señora Arce en el pasillo, cerca del camarote del señor Quiroga. Me dijo que iba al baño.»") },
          { lugar: "El camarote de Germán", pista: P("documento", "Mensajes de Germán", "Mensajes con un amigo: «Si papá no me presta la plata, estoy frito». No hay nada sobre somníferos.") }
        ]
      },
      {
        titulo: "El negocio",
        publica: P("documento", "El maletín", "En el maletín de Ramón hay una carta firmada: mañana pensaba disolver la sociedad con Sofía y quedarse con todos los hoteles."),
        privadas: [
          P("prueba", "Los camarotes de primera", "Todos los camarotes de primera clase, incluido el de Sofía, tienen baño privado. No hace falta salir al pasillo para ir al baño."),
          P("testimonio", "Sofía", "Sofía: «Me acosté a las 22:30 y no salí del camarote en toda la noche. Ni sabía que Ramón quería romper la sociedad.»"),
          P("documento", "Correo de Ramón", "En la tablet de Ramón hay un correo que le mandó a Sofía ayer: «Hablemos en el tren. Tengo una decisión tomada sobre la sociedad».")
        ],
        opciones: [
          { lugar: "El camarote de Sofía", pista: P("prueba", "Debajo de la cama", "En el piso, debajo de la cama, hay granitos blancos y un pequeño mortero para moler pastillas. Sofía no toma ninguna medicación.") },
          { lugar: "El bolso de la médica", pista: P("prueba", "El bolso de la médica", "Todos los medicamentos están ordenados en un estuche, menos uno: el hueco de la tira de somníferos que ella reportó como robada.") }
        ]
      }
    ],
    solucion: "Sofía sabía por el correo de Ramón que él iba a romper la sociedad. En la cena aprovechó que la médica fue al baño para robarle los somníferos del bolso. Los molió en su camarote y los guardó en un sobrecito de azúcar. A las 23:05 salió al pasillo (aunque tenía baño privado), encontró la taza sola en la bandeja y vació el polvo. Tiró el sobre en el tacho del pasillo. Quería que Ramón no llegara a firmar nada a la mañana.",
    finales: {
      a: "El guarda acompaña a Sofía hasta la estación de Bariloche, donde la espera la policía. Al día siguiente Ramón despierta en el hospital y lo primero que pide es un té… preparado por él mismo.",
      b: "Bajan a Julián en la estación siguiente y pierde su trabajo. Ramón despierta y, sin sospechar nada, firma unos papeles que le acerca su socia «para que descanse tranquilo»…",
      c: "Detienen a la Dra. Vidal con su propio bolso como prueba. Cuando Ramón despierta, la sociedad ya está «reestructurada» a favor de Sofía, que ahora es la única dueña.",
      d: "Germán va detenido mientras su padre duerme. Cuando Ramón despierta y se entera, no le vuelve a hablar a su hijo. Sofía le da el pésame… y se queda con la mitad de los hoteles."
    }
  },

  {
    id: "flan", titulo: "Sal en la final", lugar: "Estudio 3, «La Gran Final» · domingo, 14:30", dificultad: 1, emoji: "🍮",
    teaser: "La favorita del concurso de cocina sirve un flan… salado.",
    intro: [
      "Es la final del concurso de cocina más visto del país. La favorita, Mara Luna, presentó su famoso flan y el jurado lo escupió: estaba hecho con sal en lugar de azúcar. Mara jura que usó el frasco de AZÚCAR de su estación, como siempre.",
      "Los frascos de sal y de azúcar son idénticos, solo cambian las etiquetas. Alguien las cambió. La producción les pide resolverlo antes de que termine la tanda publicitaria."
    ],
    sospechosos: [
      { id: "a", nombre: "Hugo Ferrari", rol: "Chef finalista", desc: "Perdió contra Mara en la final del año pasado y lo repite en cada entrevista.", motivo: "Revancha", color: "#ff922b", acc: ["chef", "bigote"] },
      { id: "b", nombre: "Clara Ruiz", rol: "Chef finalista", desc: "Se peleó a los gritos con Mara en el capítulo anterior, frente a las cámaras.", motivo: "Pelea", color: "#f06595", acc: ["chef", "pelo"] },
      { id: "c", nombre: "Rafa Ortega", rol: "Chef finalista", desc: "El más tranquilo de los finalistas. Lo vieron cerca de la despensa.", motivo: "Ganar la final", color: "#51cf66", acc: ["chef", "barba"] },
      { id: "d", nombre: "Leticia Mon", rol: "Productora", desc: "Controla todo lo que pasa en el estudio, incluidas las cámaras.", motivo: "Ninguno conocido", color: "#748ffc", acc: ["auriculares", "lentes"] }
    ],
    culpable: "d",
    actos: [
      {
        titulo: "La estación",
        publica: P("prueba", "Los frascos", "En la estación de Mara, el frasco que dice AZÚCAR tiene sal y el que dice SAL tiene azúcar. Las etiquetas están pegadas encima de otras etiquetas."),
        privadas: [
          P("documento", "Las cámaras", "La cámara que apunta a la estación de Mara estuvo apagada de 14:00 a 14:20 «por mantenimiento». Las cámaras solo se apagan desde la sala de control."),
          P("testimonio", "La maquilladora", "«Hugo estuvo conmigo en maquillaje de 14:00 a 14:30. No se calla nunca: me contó toda su receta.»"),
          P("testimonio", "Un asistente", "«A las 14:10 vi a Rafa salir de la despensa con una bolsa grande de sal gruesa.»")
        ],
        opciones: [
          { lugar: "La sala de control", pista: P("documento", "Libro de la sala de control", "Quien apagó la cámara 4 a las 14:00 firmó «L. Mon». Motivo: «mantenimiento». No hay ningún técnico registrado ese día.") },
          { lugar: "La despensa", pista: P("prueba", "La despensa", "Faltan dos bolsas de sal gruesa. No hay etiquetas sueltas ni frascos fuera de lugar.") }
        ]
      },
      {
        titulo: "Los rivales",
        publica: P("testimonio", "Rafa explica", "Rafa: «Sí, saqué sal. Mi plato era pescado a la sal y lleva dos kilos para cubrirlo». Su plato, efectivamente, tenía una costra de sal."),
        privadas: [
          P("documento", "El video de Clara", "Clara grabó una entrevista para el programa de 14:05 a 14:25. El video tiene la hora en pantalla y ella no sale de cuadro."),
          P("prueba", "Las etiquetas nuevas", "Las etiquetas pegadas encima están impresas con la letra del programa. Las originales de Mara están escritas a mano."),
          P("testimonio", "Clara y Mara", "Clara: «Sí, nos peleamos. Pero quiero ganarle cocinando. Ganarle a una Mara con flan salado no vale nada.»")
        ],
        opciones: [
          { lugar: "La impresora de producción", pista: P("documento", "Cola de impresión", "La impresora de etiquetas de la oficina de producción imprimió a las 13:55 «AZÚCAR» y «SAL», desde la computadora de Leticia Mon.") },
          { lugar: "El camarín de Hugo", pista: P("prueba", "El camarín de Hugo", "Una carpeta con recortes de prensa sobre Mara, todos subrayados. Da un poco de miedo, pero no hay nada relacionado con frascos.") }
        ]
      },
      {
        titulo: "El rating",
        publica: P("documento", "Memo del canal", "Un memo del canal a la producción: «Si la final no tiene drama, el programa no vuelve el año que viene»."),
        privadas: [
          P("testimonio", "Leticia", "Leticia: «¿Yo? Estuve en la sala de control toda la tarde, mirando las cámaras. No vi nada raro.»"),
          P("prueba", "El escritorio de Leticia", "En el escritorio de Leticia hay un rollo de etiquetas autoadhesivas en blanco, iguales a las de los frascos."),
          P("documento", "Mensaje al conductor", "Leticia le escribió al conductor a las 14:35: «Prepará la cara de sorpresa que se viene lo mejor de la temporada 😉».")
        ],
        opciones: [
          { lugar: "Los números del rating", pista: P("documento", "El rating", "El momento del flan salado fue el pico de audiencia de toda la temporada. Leticia ya pidió repetirlo en el resumen.") },
          { lugar: "Hablar con Mara", pista: P("testimonio", "Mara", "«Revisé los frascos a las 13:50 y estaban bien, con mis etiquetas escritas a mano. Después me llamaron a una reunión con la productora hasta las 14:25.»") }
        ]
      }
    ],
    solucion: "Leticia necesitaba drama para salvar el programa. A las 13:55 imprimió etiquetas nuevas desde su computadora. A las 14:00 apagó la cámara de la estación de Mara y la llamó a una reunión para sacarla del medio. Mientras tanto pegó las etiquetas cambiadas encima de las originales. Hugo, Clara y Rafa tenían motivos, pero no la oportunidad.",
    finales: {
      a: "Hugo queda descalificado en vivo y llora frente a cámaras. El rating explota otra vez. En la sala de control, Leticia sonríe: «Esto se renueva por tres temporadas más».",
      b: "Expulsan a Clara del programa y las redes la destrozan. Al año siguiente, otro «sabotaje» sacude la final… y la productora, otra vez, logra el mejor rating de su carrera.",
      c: "Rafa se va con su pescado a la sal y la frente en alto. La final se repite la semana siguiente y otra vez pasa algo raro en la estación de Mara. Qué casualidad.",
      d: "Al ver la cola de impresión, Leticia suspira: «Era solo un poco de sal». El canal la despide, Mara repite su flan en vivo y gana la final. El rating de esa noche es todavía más alto."
    }
  }
];
