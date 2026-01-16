import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";

// Register fonts if needed (optional, for better typography)
// Font.register({
//   family: "Open Sans",
//   src: "https://fonts.gstatic.com/s/opensans/v18/mem8YaGs126MiZpBA-UFVZ0e.ttf"
// });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica"
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
    fontWeight: "bold",
    color: "#1a1a1a"
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 30,
    color: "#666666"
  },
  dreamContainer: {
    marginBottom: 30,
    pageBreakInside: "avoid"
  },
  dreamHeader: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: "1px solid #e0e0e0"
  },
  dreamDate: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 4
  },
  dreamTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 8
  },
  dreamImage: {
    width: "100%",
    maxHeight: 300,
    objectFit: "cover",
    marginBottom: 12,
    borderRadius: 4
  },
  dreamDescription: {
    fontSize: 11,
    color: "#333333",
    lineHeight: 1.6,
    marginTop: 8
  },
  pageNumber: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 10,
    color: "#999999"
  }
});

type Dream = {
  id: string;
  title: string;
  description: string | null;
  dream_date: string;
  image_url: string | null;
  thumbnail_url: string | null;
};

type DreamJournalPDFProps = {
  dreams: Dream[];
  userName: string;
  totalDays: number;
};

export function DreamJournalPDF({ dreams, userName, totalDays }: DreamJournalPDFProps) {
  const imageUrlToUse = (dream: Dream) => dream.thumbnail_url || dream.image_url;

  return (
    <Document>
      {dreams.map((dream, index) => (
        <Page key={dream.id} size="A4" style={styles.page}>
          {index === 0 && (
            <>
              <Text style={styles.title}>{userName}&apos;s Dream Journal</Text>
              <Text style={styles.subtitle}>
                {dreams.length} Dreams in {totalDays} Days
              </Text>
            </>
          )}
          
          <View style={styles.dreamContainer}>
            <View style={styles.dreamHeader}>
              <Text style={styles.dreamDate}>
                {new Date(dream.dream_date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                })}
              </Text>
              <Text style={styles.dreamTitle}>{dream.title}</Text>
            </View>
            
            {imageUrlToUse(dream) && (
              <Image
                src={imageUrlToUse(dream)}
                style={styles.dreamImage}
              />
            )}
            
            {dream.description && (
              <Text style={styles.dreamDescription}>{dream.description}</Text>
            )}
          </View>
          
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            fixed
          />
        </Page>
      ))}
    </Document>
  );
}

