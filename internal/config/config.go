package config

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/goccy/go-yaml"
	"github.com/randallmlough/resume-builder/internal/util"
)

type BaseSection struct {
	Hide bool `yaml:"hide"`
}
type Config struct {
	TemplateName string `yaml:"template_name"`
	AccentColor  string `yaml:"accent_color"`
	MutedColor   string `yaml:"muted_color"`
	FontSans     string `yaml:"font_sans"`
	FontSerif    string `yaml:"font_serif"`

	Contact    BaseSection `yaml:"contact"`
	PageMarker BaseSection `yaml:"page_marker"`
	Summary    BaseSection `yaml:"summary"`
	Skills     BaseSection `yaml:"skills"`
	Experience Experience  `yaml:"experience"`
	Education  BaseSection `yaml:"education"`
	Projects   BaseSection `yaml:"projects"`
	Awards     BaseSection `yaml:"awards"`
}

type Experience struct {
	BaseSection
	HideOverview     bool `yaml:"hide_overview"`
	HideLocation     bool `yaml:"hide_location"`
	HideDate         bool `yaml:"hide_date"`
	HideTechnologies bool `yaml:"hide_technologies"`
}

func LoadConfig() (*Config, error) {
	dir, err := util.GetProjectPath()
	if err != nil {
		return nil, err
	}

	// load config.yml file
	filename := filepath.Join(filepath.Dir(dir), "config.yml")
	fmt.Println("Loading config from", filename)
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	bytes, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	cfg := Config{}
	if err := yaml.Unmarshal(bytes, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}
