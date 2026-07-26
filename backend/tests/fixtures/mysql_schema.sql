CREATE TABLE IF NOT EXISTS faculties (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(150) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_faculties_code (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS careers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  faculty_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(150) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_careers_code (code),
  KEY idx_careers_faculty (faculty_id),
  CONSTRAINT fk_careers_faculty FOREIGN KEY (faculty_id)
    REFERENCES faculties (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS students (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  career_id BIGINT UNSIGNED NOT NULL,
  document_number VARCHAR(30) NOT NULL,
  email VARCHAR(190) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  enrolled_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_document (document_number),
  KEY idx_students_career_email (career_id, email),
  CONSTRAINT fk_students_career FOREIGN KEY (career_id)
    REFERENCES careers (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS courses (
  career_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(150) NOT NULL,
  credits DECIMAL(4,1) NOT NULL DEFAULT 0,
  PRIMARY KEY (career_id, code),
  CONSTRAINT fk_courses_career FOREIGN KEY (career_id)
    REFERENCES careers (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS periods (
  year_number INT NOT NULL,
  period_number INT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  PRIMARY KEY (year_number, period_number)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS enrollments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  career_id BIGINT UNSIGNED NOT NULL,
  course_code VARCHAR(20) NOT NULL,
  year_number INT NOT NULL,
  period_number INT NOT NULL,
  grade DOUBLE NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enrollment (student_id, career_id, course_code, year_number, period_number),
  KEY idx_enrollment_course (career_id, course_code),
  KEY idx_enrollment_period (year_number, period_number),
  CONSTRAINT fk_enrollment_student FOREIGN KEY (student_id)
    REFERENCES students (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_enrollment_course FOREIGN KEY (career_id, course_code)
    REFERENCES courses (career_id, code) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_enrollment_period FOREIGN KEY (year_number, period_number)
    REFERENCES periods (year_number, period_number) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  class VARCHAR(100) NOT NULL,
  class_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  payload BLOB NULL,
  PRIMARY KEY (id),
  KEY idx_documents_polymorphic_storage_only (class, class_id)
) ENGINE=InnoDB;

CREATE OR REPLACE VIEW active_students AS
SELECT id, career_id, document_number, email
FROM students
WHERE active = 1;
