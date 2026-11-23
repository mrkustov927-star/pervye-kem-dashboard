// Ссылки из Порядка выполнения заданий, с. 25–26, 29–30 и 57–58.
const revisedMaterials = {
  "family_hike": [
    [
      "Рекомендации по организации семейного похода",
      "https://cloud.mail.ru/public/oP7j/dLZXqWx2s"
    ],
    [
      "Как подать заявку на участие в «Походах Первых»",
      "https://ответы.будьвдвижении.рф/material/0d54d943-e33e-42f3-923d-cc943692e514"
    ]
  ],
  "cinema": [
    [
      "«Капитан Невельской» — книги и настольные игры издательства «Просвещение»",
      "https://prosv.ru/catalog/kapitan-nevel-skoi2307591/"
    ]
  ],
  "eco": [
    [
      "Порядок деятельности сообщества юных натуралистов",
      "https://cloud.mail.ru/public/nZkB/8NwrWsLFw"
    ],
    [
      "Программа «Экология и охрана природы»",
      "https://методист.рф/files/programma-raboty-s-detmi-i-molodyezhyu-po-napravleniyu-ekologiya-i-okhrana-prirody/"
    ],
    [
      "Юннатская игротека — задания для станций",
      "https://cloud.mail.ru/public/NYKM/uku5WVQhd"
    ]
  ]
};

export function taskMaterials(record) {
  return revisedMaterials[record.variantId] ?? record.materials ?? [];
}
