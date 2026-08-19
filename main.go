package main

import (
	"log"

	"github.com/randallmlough/resume-builder/internal/config"
	"github.com/randallmlough/resume-builder/internal/resume"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	personalDetails, err := resume.LoadPersonalDetails("resume.json")
	if err != nil {
		log.Fatal(err)
	}

	// Generate LaTeX from the resume struct
	if err := resume.GenerateResume(personalDetails, cfg); err != nil {
		log.Fatalf("Failed to generate resume: %v", err)
	}

	log.Println("Successfully generated resume.tex")
}
