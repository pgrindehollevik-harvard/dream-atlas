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
  // For videos, use thumbnail_url. For images, use image_url.
  // Prioritize thumbnail_url if it exists (for videos), otherwise use image_url (for images)
  const getImageUrl = (dream: Dream): string | null => {
    if (dream.thumbnail_url) {
      return dream.thumbnail_url;
    }
    return dream.image_url;
  };

  // Format date helper
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch (err) {
      return dateStr;
    }
  };

  // Ensure dreams is an array
  const validDreams = Array.isArray(dreams) ? dreams : [];
  const userNameStr = String(userName || "User");
  const dreamsCount = String(dreams.length);
  const daysCount = String(totalDays);

  return (
    <Document>
      {validDreams.map((dream, index) => {
        // Ensure dream has required fields
        if (!dream || !dream.id || !dream.title) {
          return null;
        }
        
        const imgUrl = getImageUrl(dream);
        const formattedDate = formatDate(dream.dream_date);
        const title = String(dream.title || "");
        const description = dream.description ? String(dream.description) : null;
        
        return (
          <Page key={dream.id} size="A4" style={styles.page}>
            {index === 0 && (
              <>
                <Text style={styles.title}>{userNameStr}&apos;s Dream Journal</Text>
                <Text style={styles.subtitle}>
                  {dreamsCount} Dreams in {daysCount} Days
                </Text>
              </>
            )}
            
            <View style={styles.dreamContainer}>
              <View style={styles.dreamHeader}>
                <Text style={styles.dreamDate}>{formattedDate}</Text>
                <Text style={styles.dreamTitle}>{title}</Text>
              </View>
              
              {imgUrl && typeof imgUrl === "string" && (
                <Image src={imgUrl} style={styles.dreamImage} />
              )}
              
              {description && (
                <Text style={styles.dreamDescription}>{description}</Text>
              )}
            </View>
          </Page>
        );
      })}
    </Document>
  );
}

