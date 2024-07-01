RMD_FILES=$(wildcard *.Rmd)
HTML_FILES=$(RMD_FILES:.Rmd=.html)

all: $(HTML_FILES)

%.html: %.Rmd
	Rscript -e 'rmarkdown::render_site("$<")'

clean:
	Rscript -e 'rmarkdown::clean_site()'
