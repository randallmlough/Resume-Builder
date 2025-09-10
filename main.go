package main

import (
	"log"
	"os"
)

func main() {
	resume, err := LoadResume("resume.json")
	if err != nil {
		log.Fatal(err)
	}

	cfg, err := LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Generate LaTeX from the resume struct
	latexContent, err := resume.GenerateLaTeX(cfg)
	if err != nil {
		log.Fatalf("Failed to generate LaTeX: %v", err)
	}

	// Write the LaTeX content to a file
	outputFile, err := os.Create("resume.tex")
	if err != nil {
		log.Fatalf("Failed to create output file: %v", err)
	}
	defer outputFile.Close()

	if _, err := outputFile.WriteString(latexContent); err != nil {
		log.Fatalf("Failed to write LaTeX content: %v", err)
	}

	log.Println("Successfully generated resume.tex")
}
